import express from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { createServer as createViteServer } from "vite";
import { AppState, Vendor, StockItem, Sale, TradeProposal, CashoutRequest, TradeIn } from "./src/types";
import { isSaleMature } from "./src/payoutUtils";

dotenv.config();

const app = express();
const PORT = 3000;

// Use JSON body parser with increased limit to handle base64 image uploads for trades
app.use(express.json({ limit: "15mb" }));

const DB_FILE = path.join(process.cwd(), "data.json");

// Helper to get relative date strings for seeding relative to 2026-07-14T06:28:56-07:00
const getPastDateISO = (daysAgo: number): string => {
  const baseDate = new Date("2026-07-14T06:28:56-07:00");
  baseDate.setDate(baseDate.getDate() - daysAgo);
  return baseDate.toISOString();
};

const DEFAULT_STATE: AppState = {
  vendors: [],
  stock: [],
  sales: [],
  trades: [],
  cashouts: [],
  tradeIns: []
};

// Database state in-memory cache
let state: AppState = { ...DEFAULT_STATE };

// Parse Firebase configuration if available
const configPath = path.join(process.cwd(), "firebase-applet-config.json");
let firebaseConfig: any = null;
try {
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  }
} catch (e) {
  console.error("Error reading firebase-applet-config.json:", e);
}

// Initialize firebase-admin if config is available
if (firebaseConfig && getApps().length === 0) {
  initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

const db = firebaseConfig && firebaseConfig.firestoreDatabaseId
  ? getFirestore(firebaseConfig.firestoreDatabaseId)
  : (firebaseConfig ? getFirestore() : null);

// Load State from data.json (local fallback/seeding)
const loadState = () => {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, "utf-8");
      state = JSON.parse(raw);
    }
  } catch (err) {
    console.error("Error loading database file, using in-memory state", err);
  }
};

// Store active SSE clients
let sseClients: { id: number; res: any }[] = [];

// Broadcast helper
const broadcastUpdate = () => {
  const data = JSON.stringify({ type: "update" });
  sseClients.forEach((client) => {
    try {
      client.res.write(`data: ${data}\n\n`);
    } catch (err) {
      console.error("Error writing to SSE client", err);
    }
  });
};

// Save State to data.json and keep backups, syncing to Firestore
const saveState = async () => {
  try {
    // 1. Save main DB_FILE
    fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), "utf-8");
    
    // 2. Save a mirror backup
    const backupFile = path.join(process.cwd(), "data.backup.json");
    fs.writeFileSync(backupFile, JSON.stringify(state, null, 2), "utf-8");

    // 3. Keep a rotating historical backup in backups/ folder
    const backupsDir = path.join(process.cwd(), "backups");
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const historicalFile = path.join(backupsDir, `state_backup_${timestamp}.json`);
    fs.writeFileSync(historicalFile, JSON.stringify(state, null, 2), "utf-8");

    // Prune backups to keep the 15 most recent
    const files = fs.readdirSync(backupsDir)
      .filter(f => f.startsWith("state_backup_") && f.endsWith(".json"))
      .map(f => ({ name: f, time: fs.statSync(path.join(backupsDir, f)).mtime.getTime() }))
      .sort((a, b) => b.time - a.time);

    if (files.length > 15) {
      for (let i = 15; i < files.length; i++) {
        try {
          fs.unlinkSync(path.join(backupsDir, files[i].name));
        } catch (e) {
          console.error("Error pruning backup file", e);
        }
      }
    }

    // 4. Save to Firestore in real-time
    if (db) {
      const batch = db.batch();
      const keys: (keyof AppState)[] = ["vendors", "stock", "sales", "trades", "cashouts", "tradeIns"];
      keys.forEach((key) => {
        const docRef = db.collection("marketState").doc(key);
        batch.set(docRef, { data: state[key] || [] });
      });
      await batch.commit();
      console.log("State written to Firestore successfully!");
    } else {
      broadcastUpdate();
    }
  } catch (err) {
    console.error("Error writing database file and creating backups", err);
  }
};

// Initialize Database connection and synchronize state
const initializeDatabase = async () => {
  if (!db) {
    console.log("Firebase config not found, running with local file persistence only.");
    loadState();
    // Save once if data.json doesn't exist
    if (!fs.existsSync(DB_FILE)) {
      saveState();
    }
    return;
  }

  try {
    const collectionRef = db.collection("marketState");
    const snapshot = await collectionRef.get();

    if (snapshot.empty) {
      console.log("Firestore is empty. Seeding Firestore with local data.json contents...");
      // Load current local state
      loadState();
      // Seed Firestore
      const batch = db.batch();
      const keys: (keyof AppState)[] = ["vendors", "stock", "sales", "trades", "cashouts", "tradeIns"];
      keys.forEach((key) => {
        const docRef = collectionRef.doc(key);
        batch.set(docRef, { data: state[key] || [] });
      });
      await batch.commit();
      console.log("Firestore seeding completed successfully!");
    } else {
      console.log("Loading state from Firestore...");
      snapshot.forEach((doc) => {
        const key = doc.id as keyof AppState;
        const val = doc.data()?.data;
        if (val && Array.isArray(val)) {
          (state as any)[key] = val;
        }
      });
      // Save local cache copy
      fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), "utf-8");
      console.log("State loaded successfully from Firestore.");
    }

    // Set up real-time listener for any external updates (e.g. from other devices/containers)
    collectionRef.onSnapshot((snap) => {
      let changed = false;
      snap.docChanges().forEach((change) => {
        const key = change.doc.id as keyof AppState;
        const val = change.doc.data()?.data;
        if (val && Array.isArray(val)) {
          // Compare JSON string to avoid redundant writes/broadcasts
          const currentStr = JSON.stringify(state[key] || []);
          const newStr = JSON.stringify(val || []);
          if (currentStr !== newStr) {
            (state as any)[key] = val;
            changed = true;
          }
        }
      });

      if (changed) {
        console.log("Real-time update received from Firestore, syncing local cache & broadcasting...");
        fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), "utf-8");
        broadcastUpdate();
      }
    }, (err) => {
      console.error("Firestore onSnapshot error:", err);
    });

  } catch (err) {
    console.error("Failed to initialize Firestore connection. Falling back to local data.json.", err);
    loadState();
  }
};

// Initialize database immediately
initializeDatabase();

// -----------------------------------------------------------------------------
// API ENDPOINTS
// -----------------------------------------------------------------------------

// Validate PIN / Login
app.post("/api/login", (req, res) => {
  const { pin } = req.body;
  if (!pin) {
    res.status(400).json({ error: "PIN is required" });
    return;
  }

  // Master PIN check
  if (pin === "9999") {
    res.json({
      role: "admin",
      user: { id: "master", name: "Newton (Master Control)" }
    });
    return;
  }

  // Vendor PIN check
  const vendor = state.vendors.find((v) => v.pin === pin);
  if (vendor) {
    res.json({
      role: "vendor",
      user: vendor
    });
  } else {
    res.status(401).json({ error: "Invalid PIN. Please try again." });
  }
});

// Get state (filtered or raw depending on auth)
app.get("/api/state", (req, res) => {
  // Return whole state. Authorization/filtering happens client side or is passed via queries
  res.json(state);
});

// Real-time updates subscription endpoint via Server-Sent Events (SSE)
app.get("/api/updates", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive"
  });

  // Send initial handshake
  res.write("data: connected\n\n");

  const clientId = Date.now() + Math.random();
  const newClient = { id: clientId, res };
  sseClients.push(newClient);

  // Client connection teardown
  req.on("close", () => {
    sseClients = sseClients.filter((c) => c.id !== clientId);
  });
});

// Update Vendor detail (Admin only)
app.post("/api/admin/vendors", (req, res) => {
  const { id, name, pin, commission, color } = req.body;

  const targetId = id && id.trim() !== "" ? id : null;

  if (targetId) {
    const index = state.vendors.findIndex((v) => v.id === targetId);
    if (index !== -1) {
      state.vendors[index] = {
        ...state.vendors[index],
        name: name !== undefined ? name : state.vendors[index].name,
        pin: pin !== undefined ? pin : state.vendors[index].pin,
        commission: commission !== undefined ? Number(commission) : state.vendors[index].commission,
        color: color !== undefined ? color : state.vendors[index].color,
      };
      saveState();
      res.json({ success: true, vendor: state.vendors[index] });
      return;
    }
  }

  // Create new vendor
  const newVendorId = targetId || "v_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
  const newVendor: Vendor = {
    id: newVendorId,
    name,
    pin,
    commission: Number(commission) || 0.10,
    tradeCredit: 0.0,
    color: color || "#64748B" // default slate
  };
  state.vendors.push(newVendor);
  saveState();
  res.json({ success: true, vendor: newVendor });
});

// GET list of all available backups
app.get("/api/admin/backups", (req, res) => {
  try {
    const backupsDir = path.join(process.cwd(), "backups");
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }
    const files = fs.readdirSync(backupsDir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => {
        const filePath = path.join(backupsDir, f);
        const stats = fs.statSync(filePath);
        return {
          filename: f,
          size: stats.size,
          mtime: stats.mtime.toISOString(),
        };
      })
      .sort((a, b) => b.mtime.localeCompare(a.mtime));

    const backupFile = path.join(process.cwd(), "data.backup.json");
    res.json({
      backups: files,
      currentDbSize: fs.existsSync(DB_FILE) ? fs.statSync(DB_FILE).size : 0,
      currentDbMtime: fs.existsSync(DB_FILE) ? fs.statSync(DB_FILE).mtime.toISOString() : null,
      mirrorDbSize: fs.existsSync(backupFile) ? fs.statSync(backupFile).size : 0,
      mirrorDbMtime: fs.existsSync(backupFile) ? fs.statSync(backupFile).mtime.toISOString() : null,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST to create a manual timestamped backup
app.post("/api/admin/backups/create", (req, res) => {
  try {
    const backupsDir = path.join(process.cwd(), "backups");
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const manualFile = path.join(backupsDir, `state_manual_${timestamp}.json`);
    fs.writeFileSync(manualFile, JSON.stringify(state, null, 2), "utf-8");
    res.json({ success: true, filename: `state_manual_${timestamp}.json` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST to restore database state from a file
app.post("/api/admin/backups/restore", (req, res) => {
  const { filename } = req.body;
  if (!filename) {
    res.status(400).json({ error: "Filename is required" });
    return;
  }
  try {
    let targetPath = DB_FILE;
    if (filename === "backup") {
      targetPath = path.join(process.cwd(), "data.backup.json");
    } else if (filename !== "current") {
      const cleanName = path.basename(filename);
      targetPath = path.join(process.cwd(), "backups", cleanName);
    }

    if (!fs.existsSync(targetPath)) {
      res.status(404).json({ error: "Selected backup file does not exist" });
      return;
    }

    const raw = fs.readFileSync(targetPath, "utf-8");
    const parsed = JSON.parse(raw);

    if (!parsed.vendors || !parsed.stock || !parsed.sales) {
      res.status(400).json({ error: "Invalid database backup file format" });
      return;
    }

    state = parsed;
    saveState();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to restore: " + err.message });
  }
});

// POST to upload a custom JSON database backup
app.post("/api/admin/backups/upload", (req, res) => {
  const { payload } = req.body;
  if (!payload) {
    res.status(400).json({ error: "Backup JSON payload is required" });
    return;
  }
  try {
    let parsed: any;
    if (typeof payload === "string") {
      parsed = JSON.parse(payload);
    } else {
      parsed = payload;
    }

    if (!parsed.vendors || !parsed.stock || !parsed.sales) {
      res.status(400).json({ error: "Invalid backup database schema. Missing vendors, stock, or sales keys." });
      return;
    }

    state = parsed;
    saveState();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Invalid JSON format: " + err.message });
  }
});

// GET to download a database backup file
app.get("/api/admin/backups/download", (req, res) => {
  const { file } = req.query;
  try {
    let targetPath = DB_FILE;
    let downloadName = "newtons_market_database.json";

    if (file && typeof file === "string" && file !== "current") {
      if (file === "backup") {
        targetPath = path.join(process.cwd(), "data.backup.json");
        downloadName = "data.backup.json";
      } else {
        const cleanName = path.basename(file);
        targetPath = path.join(process.cwd(), "backups", cleanName);
        downloadName = cleanName;
      }
    }

    if (!fs.existsSync(targetPath)) {
      res.status(404).send("Backup file not found on disk");
      return;
    }

    res.setHeader("Content-Disposition", `attachment; filename="${downloadName}"`);
    res.setHeader("Content-Type", "application/json");
    res.sendFile(targetPath);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

// Log a sale (from Joint Staff page or vendor themselves)
app.post("/api/sales", (req, res) => {
  const { vendorId, itemName, stockItemId, price, date, items, tradeIn } = req.body;

  if (!vendorId) {
    res.status(400).json({ error: "vendorId is required" });
    return;
  }

  const vendor = state.vendors.find((v) => v.id === vendorId);
  if (!vendor) {
    res.status(404).json({ error: "Vendor not found" });
    return;
  }

  // Handle multiple items or single item
  let itemsToProcess = [];
  if (items && Array.isArray(items)) {
    itemsToProcess = items;
  } else if (itemName || price !== undefined) {
    itemsToProcess = [{ itemName, stockItemId, price }];
  }

  // Validate items if any are present
  for (const item of itemsToProcess) {
    if (!item.itemName || item.price === undefined || item.price === null || isNaN(Number(item.price))) {
      res.status(400).json({ error: "Each item must have a valid itemName and price" });
      return;
    }
  }

  // Ensure either sale items or tradeIn is provided
  if (itemsToProcess.length === 0 && !tradeIn) {
    res.status(400).json({ error: "Please provide either sale items or a trade-in transaction" });
    return;
  }

  const loggedSales: Sale[] = [];

  // 1. Process Sale Items
  for (let i = 0; i < itemsToProcess.length; i++) {
    const item = itemsToProcess[i];
    const salePrice = Number(item.price);
    const commRate = vendor.commission;
    const commAmount = Number((salePrice * commRate).toFixed(2));
    const earnings = Number((salePrice - commAmount).toFixed(2));

    // If connected to a stock item, decrement quantity
    if (item.stockItemId) {
      const stockItem = state.stock.find((s) => s.id === item.stockItemId);
      if (stockItem) {
        if (stockItem.quantity > 1) {
          stockItem.quantity -= 1;
        } else {
          stockItem.quantity = 0;
        }
      }
    }

    const newSale: Sale = {
      id: "sale_" + Date.now() + "_" + Math.floor(Math.random() * 100000) + "_" + i,
      vendorId,
      vendorName: vendor.name,
      itemName: item.itemName,
      stockItemId: item.stockItemId || null,
      price: salePrice,
      commissionAmount: commAmount,
      vendorEarnings: earnings,
      date: date || new Date().toISOString(),
      cashedOut: false,
      cashoutRequestId: null,
    };

    loggedSales.push(newSale);
    state.sales.push(newSale);
  }

  // 2. Process Trade-In if provided
  if (tradeIn && tradeIn.details && tradeIn.amount !== undefined && tradeIn.amount !== null) {
    const tradeInAmount = Number(tradeIn.amount);
    if (!isNaN(tradeInAmount) && tradeInAmount > 0) {
      // Deduct from vendor's trade credit balance (their account)
      vendor.tradeCredit = Number((vendor.tradeCredit - tradeInAmount).toFixed(2));

      // Log a TradeIn record
      const newTradeIn: TradeIn = {
        id: "tradein_" + Date.now() + "_" + Math.floor(Math.random() * 10000),
        vendorId,
        vendorName: vendor.name,
        details: "[Register Trade-In] " + tradeIn.details,
        estimatedValue: tradeInAmount,
        creditApplied: -tradeInAmount, // negative means deduction/applied-away
        status: "approved", // Directly approved because it was registered at the till by staff
        date: date || new Date().toISOString()
      };

      state.tradeIns.push(newTradeIn);
    }
  }

  saveState();
  res.json({ success: true, sales: loggedSales, stock: state.stock, tradeIns: state.tradeIns, vendors: state.vendors });
});

// Add or Edit Stock
app.post("/api/stock", (req, res) => {
  const { id, name, price, vendorId, quantity, rarity, setName, imageUrl } = req.body;

  if (!name || !price || !vendorId) {
    res.status(400).json({ error: "name, price, and vendorId are required" });
    return;
  }

  const vendor = state.vendors.find((v) => v.id === vendorId);
  if (!vendor) {
    res.status(404).json({ error: "Vendor not found" });
    return;
  }

  if (id) {
    // Edit existing
    const index = state.stock.findIndex((s) => s.id === id);
    if (index !== -1) {
      state.stock[index] = {
        ...state.stock[index],
        name,
        price: Number(price),
        quantity: Number(quantity) || 1,
        rarity: rarity || state.stock[index].rarity,
        setName: setName || state.stock[index].setName,
        imageUrl: imageUrl || state.stock[index].imageUrl
      };
      saveState();
      res.json({ success: true, item: state.stock[index] });
      return;
    }
  }

  // Create new stock item
  const newItem: StockItem = {
    id: "stock_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
    name,
    price: Number(price),
    vendorId,
    vendorName: vendor.name,
    quantity: Number(quantity) || 1,
    rarity: rarity || "",
    setName: setName || "",
    imageUrl: imageUrl || "",
    dateAdded: new Date().toISOString()
  };

  state.stock.push(newItem);
  saveState();
  res.json({ success: true, item: newItem });
});

// Create trade proposal
app.post("/api/trades", (req, res) => {
  const { proposerId, receiverId, offeredItemNames, requestedItemNames, offeredCash, imageUrl, notes } = req.body;

  if (!proposerId || !receiverId || !offeredItemNames || !requestedItemNames) {
    res.status(400).json({ error: "proposerId, receiverId, offeredItemNames, and requestedItemNames are required" });
    return;
  }

  const proposer = state.vendors.find((v) => v.id === proposerId);
  const receiver = state.vendors.find((v) => v.id === receiverId);

  if (!proposer || !receiver) {
    res.status(404).json({ error: "Proposer or Receiver vendor not found" });
    return;
  }

  const cashOffer = Number(offeredCash) || 0;

  const newTrade: TradeProposal = {
    id: "trade_" + Date.now(),
    proposerId,
    proposerName: proposer.name,
    receiverId,
    receiverName: receiver.name,
    offeredItemNames,
    requestedItemNames,
    offeredCash: cashOffer,
    imageUrl: imageUrl || "",
    status: "pending",
    date: new Date().toISOString(),
    notes: notes || ""
  };

  state.trades.push(newTrade);
  saveState();
  res.json({ success: true, trade: newTrade });
});

// Respond to trade (accept, decline, counter)
app.post("/api/trades/:id/respond", (req, res) => {
  const { id } = req.params;
  const { status, notes, counterOfferedItemNames, counterRequestedItemNames, counterOfferedCash } = req.body;

  if (!status) {
    res.status(400).json({ error: "Status is required" });
    return;
  }

  const tradeIndex = state.trades.findIndex((t) => t.id === id);
  if (tradeIndex === -1) {
    res.status(404).json({ error: "Trade proposal not found" });
    return;
  }

  const trade = state.trades[tradeIndex];

  if (status === "accepted") {
    // Lock trade as accepted
    trade.status = "accepted";
    if (notes) trade.notes = notes;

    // Apply cash changes if applicable (subtract offeredCash from proposer, add tradeCredit to receiver)
    if (trade.offeredCash > 0) {
      const proposer = state.vendors.find((v) => v.id === trade.proposerId);
      const receiver = state.vendors.find((v) => v.id === trade.receiverId);
      // Ensure proposer has trade credit or balance, but since trades can be trusted or credit-backed, we adjust tradeCredit
      if (proposer && receiver) {
        proposer.tradeCredit = Number((proposer.tradeCredit - trade.offeredCash).toFixed(2));
        receiver.tradeCredit = Number((receiver.tradeCredit + trade.offeredCash).toFixed(2));
      }
    }
  } else if (status === "declined") {
    trade.status = "declined";
    if (notes) trade.notes = notes;
  } else if (status === "countered") {
    trade.status = "countered";
    
    // Create a new countered trade flipping the proposer/receiver
    const newCounterTrade: TradeProposal = {
      id: "trade_" + Date.now() + "_counter",
      proposerId: trade.receiverId, // Misty counter-proposes to Ash
      proposerName: trade.receiverName,
      receiverId: trade.proposerId,
      receiverName: trade.proposerName,
      offeredItemNames: counterOfferedItemNames || trade.requestedItemNames,
      requestedItemNames: counterRequestedItemNames || trade.offeredItemNames,
      offeredCash: Number(counterOfferedCash) || 0,
      imageUrl: trade.imageUrl,
      status: "pending",
      date: new Date().toISOString(),
      notes: notes || `Counter offer for previous trade: ${trade.id}`
    };
    state.trades.push(newCounterTrade);
  }

  saveState();
  res.json({ success: true, trades: state.trades, vendors: state.vendors });
});

// Request cashout
app.post("/api/cashouts", (req, res) => {
  const { vendorId, amount } = req.body;

  if (!vendorId || !amount) {
    res.status(400).json({ error: "vendorId and amount are required" });
    return;
  }

  const vendor = state.vendors.find((v) => v.id === vendorId);
  if (!vendor) {
    res.status(404).json({ error: "Vendor not found" });
    return;
  }

  const reqAmount = Number(amount);

  const reqId = "req_" + Date.now();
  const newRequest: CashoutRequest = {
    id: reqId,
    vendorId,
    vendorName: vendor.name,
    amount: reqAmount,
    date: new Date().toISOString(),
    status: "pending"
  };

  // Find all un-cashedout, eligible sales for this vendor using the new dynamic Friday payout rule
  let taggedSalesCount = 0;
  state.sales.forEach((sale) => {
    if (
      sale.vendorId === vendorId &&
      !sale.cashedOut &&
      !sale.cashoutRequestId &&
      isSaleMature(sale.date, new Date())
    ) {
      sale.cashoutRequestId = reqId;
      taggedSalesCount++;
    }
  });

  state.cashouts.push(newRequest);
  saveState();

  res.json({ success: true, request: newRequest, taggedSales: taggedSalesCount });
});

// Admin Approve Cashout
app.post("/api/admin/cashouts/:id/respond", (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // 'approved' or 'declined'

  if (!status || (status !== "approved" && status !== "declined")) {
    res.status(400).json({ error: "Status must be 'approved' or 'declined'" });
    return;
  }

  const reqIndex = state.cashouts.findIndex((r) => r.id === id);
  if (reqIndex === -1) {
    res.status(404).json({ error: "Cashout request not found" });
    return;
  }

  const request = state.cashouts[reqIndex];
  request.status = status;

  if (status === "approved") {
    request.payoutDate = new Date().toISOString();
    // Mark associated sales as fully cashed out
    state.sales.forEach((sale) => {
      if (sale.cashoutRequestId === id) {
        sale.cashedOut = true;
      }
    });
  } else {
    // If declined, release the sales so they can be cashing out again
    state.sales.forEach((sale) => {
      if (sale.cashoutRequestId === id) {
        sale.cashoutRequestId = null;
      }
    });
  }

  saveState();
  res.json({ success: true, cashouts: state.cashouts, sales: state.sales });
});

// Add Trade-In (logged by vendor, goes to Admin for review)
app.post("/api/trade-ins", (req, res) => {
  const { vendorId, details, estimatedValue, creditApplied } = req.body;

  if (!vendorId || !details || !estimatedValue) {
    res.status(400).json({ error: "vendorId, details, and estimatedValue are required" });
    return;
  }

  const vendor = state.vendors.find((v) => v.id === vendorId);
  if (!vendor) {
    res.status(404).json({ error: "Vendor not found" });
    return;
  }

  const newTradeIn: TradeIn = {
    id: "tradein_" + Date.now(),
    vendorId,
    vendorName: vendor.name,
    details,
    estimatedValue: Number(estimatedValue),
    creditApplied: Number(creditApplied) || Number(estimatedValue),
    status: "pending",
    date: new Date().toISOString()
  };

  state.tradeIns.push(newTradeIn);
  saveState();
  res.json({ success: true, tradeIn: newTradeIn });
});

// Admin Approve Trade-In (which adds to vendor's site credit balance)
app.post("/api/admin/trade-ins/:id/respond", (req, res) => {
  const { id } = req.params;
  const { status, finalCredit } = req.body; // 'approved' or 'declined'

  if (!status || (status !== "approved" && status !== "declined")) {
    res.status(400).json({ error: "Status must be 'approved' or 'declined'" });
    return;
  }

  const trIndex = state.tradeIns.findIndex((t) => t.id === id);
  if (trIndex === -1) {
    res.status(404).json({ error: "Trade-in record not found" });
    return;
  }

  const tradeIn = state.tradeIns[trIndex];
  tradeIn.status = status;

  if (status === "approved") {
    const credit = finalCredit !== undefined ? Number(finalCredit) : tradeIn.creditApplied;
    tradeIn.creditApplied = credit;

    // Apply trade-in credit to vendor's site balance
    const vendor = state.vendors.find((v) => v.id === tradeIn.vendorId);
    if (vendor) {
      vendor.tradeCredit = Number((vendor.tradeCredit + credit).toFixed(2));
    }
  }

  saveState();
  res.json({ success: true, tradeIns: state.tradeIns, vendors: state.vendors });
});

// Admin Update Sale
app.post("/api/admin/sales/:id/update", (req, res) => {
  const { id } = req.params;
  const { vendorId, itemName, price, date } = req.body;

  if (!vendorId || !itemName || price === undefined) {
    res.status(400).json({ error: "vendorId, itemName, and price are required" });
    return;
  }

  const saleIndex = state.sales.findIndex((s) => s.id === id);
  if (saleIndex === -1) {
    res.status(404).json({ error: "Sale not found" });
    return;
  }

  const vendor = state.vendors.find((v) => v.id === vendorId);
  if (!vendor) {
    res.status(404).json({ error: "Vendor not found" });
    return;
  }

  const salePrice = Number(price);
  const commRate = vendor.commission;
  const commAmount = Number((salePrice * commRate).toFixed(2));
  const earnings = Number((salePrice - commAmount).toFixed(2));

  state.sales[saleIndex] = {
    ...state.sales[saleIndex],
    vendorId,
    vendorName: vendor.name,
    itemName,
    price: salePrice,
    commissionAmount: commAmount,
    vendorEarnings: earnings,
    date: date || state.sales[saleIndex].date,
  };

  saveState();
  res.json({ success: true, sale: state.sales[saleIndex], sales: state.sales });
});

// Admin Delete Sale
app.post("/api/admin/sales/:id/delete", (req, res) => {
  const { id } = req.params;

  const saleIndex = state.sales.findIndex((s) => s.id === id);
  if (saleIndex === -1) {
    res.status(404).json({ error: "Sale not found" });
    return;
  }

  const sale = state.sales[saleIndex];

  // If connected to a stock item, restore the stock quantity by 1
  if (sale.stockItemId) {
    const item = state.stock.find((s) => s.id === sale.stockItemId);
    if (item) {
      item.quantity += 1;
    }
  }

  state.sales.splice(saleIndex, 1);
  saveState();
  res.json({ success: true, sales: state.sales, stock: state.stock });
});


// -----------------------------------------------------------------------------
// VITE OR STATIC FILE SERVING
// -----------------------------------------------------------------------------

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Newton's Collectables backend running on port ${PORT}`);
  });
}

startServer();
