import express from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { AppState, Vendor, StockItem, Sale, TradeProposal, CashoutRequest, TradeIn } from "./src/types";

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

// Load State from data.json
const loadState = () => {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, "utf-8");
      state = JSON.parse(raw);
    } else {
      saveState();
    }
  } catch (err) {
    console.error("Error loading database file, using in-memory state", err);
  }
};

// Save State to data.json
const saveState = () => {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing database file", err);
  }
};

// Load database immediately
loadState();

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

// Update Vendor detail (Admin only)
app.post("/api/admin/vendors", (req, res) => {
  const { id, name, pin, commission } = req.body;

  if (!id) {
    res.status(400).json({ error: "Vendor ID is required" });
    return;
  }

  const index = state.vendors.findIndex((v) => v.id === id);
  if (index !== -1) {
    state.vendors[index] = {
      ...state.vendors[index],
      name: name !== undefined ? name : state.vendors[index].name,
      pin: pin !== undefined ? pin : state.vendors[index].pin,
      commission: commission !== undefined ? Number(commission) : state.vendors[index].commission,
    };
    saveState();
    res.json({ success: true, vendor: state.vendors[index] });
  } else {
    // Create new vendor
    const newVendor: Vendor = {
      id: id || "v" + (state.vendors.length + 1),
      name,
      pin,
      commission: Number(commission) || 0.10,
      tradeCredit: 0.0
    };
    state.vendors.push(newVendor);
    saveState();
    res.json({ success: true, vendor: newVendor });
  }
});

// Log a sale (from Joint Staff page or vendor themselves)
app.post("/api/sales", (req, res) => {
  const { vendorId, itemName, stockItemId, price, date } = req.body;

  if (!vendorId || !itemName || !price) {
    res.status(400).json({ error: "vendorId, itemName, and price are required" });
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

  // If connected to a stock item, decrement quantity
  if (stockItemId) {
    const item = state.stock.find((s) => s.id === stockItemId);
    if (item) {
      if (item.quantity > 1) {
        item.quantity -= 1;
      } else {
        // Remove item from stock or set qty to 0
        item.quantity = 0;
      }
    }
  }

  const newSale: Sale = {
    id: "sale_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
    vendorId,
    vendorName: vendor.name,
    itemName,
    stockItemId: stockItemId || null,
    price: salePrice,
    commissionAmount: commAmount,
    vendorEarnings: earnings,
    date: date || new Date().toISOString(),
    cashedOut: false,
    cashoutRequestId: null,
  };

  state.sales.push(newSale);
  saveState();
  res.json({ success: true, sale: newSale, stock: state.stock });
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

  // Find all un-cashedout, eligible (older than 2 weeks) sales for this vendor
  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  let taggedSalesCount = 0;
  state.sales.forEach((sale) => {
    if (
      sale.vendorId === vendorId &&
      !sale.cashedOut &&
      !sale.cashoutRequestId &&
      new Date(sale.date) <= twoWeeksAgo
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
