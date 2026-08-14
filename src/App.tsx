import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Home,
  ShoppingBag,
  Package,
  ArrowLeftRight,
  Coins,
  ShieldCheck,
  LogOut,
  RefreshCw,
  Calendar,
  MapPin,
  Menu,
  X,
  Lock,
  Ticket
} from 'lucide-react';
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, collection, onSnapshot, doc, setDoc } from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";
import { Vendor, StockItem, Sale, TradeProposal, CashoutRequest, TradeIn, RaffleEntry, RaffleWinner, RaffleDrawResult } from './types';
import { isSaleMature, calculateVendorBalances } from './payoutUtils';
import PINLogin from './components/PINLogin';
import DashboardHome from './components/DashboardHome';
import JointStaffPage from './components/JointStaffPage';
import StockManager from './components/StockManager';
import CashoutAndTradeIn from './components/CashoutAndTradeIn';
import MasterControl from './components/MasterControl';
import { RaffleDrawTab } from './components/RaffleDrawTab';

// Initialize Firebase Client SDK for direct real-time updates on all platforms (including mobile phones)
let db: any = null;
if (firebaseConfig && firebaseConfig.projectId) {
  try {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
    console.log("Firebase Client SDK successfully initialized in React frontend");
  } catch (err) {
    console.error("Failed to initialize Firebase Client SDK in React frontend:", err);
  }
}

export default function App() {
  // Database States
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [trades, setTrades] = useState<TradeProposal[]>([]);
  const [cashouts, setCashouts] = useState<CashoutRequest[]>([]);
  const [tradeIns, setTradeIns] = useState<TradeIn[]>([]);
  const [raffleEntries, setRaffleEntries] = useState<RaffleEntry[]>([]);
  const [raffleHistory, setRaffleHistory] = useState<RaffleDrawResult[]>([]);

  // Session States
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<'vendor' | 'admin' | null>(null);
  const [activeTab, setActiveTab] = useState<string>('staff');
  const [adminViewingVendorId, setAdminViewingVendorId] = useState<string | null>(null);

  // UI Statuses
  const [isLoadingState, setIsLoadingState] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Syncing states
  const [lastSynced, setLastSynced] = useState<Date | null>(new Date());
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncMode, setSyncMode] = useState<'realtime' | 'polling' | 'mobile'>('realtime');

  // Load Entire State from backend
  const refreshAppState = async (silent = false) => {
    if (!silent) {
      setIsSyncing(true);
    }
    try {
      const res = await fetch('/api/state');
      if (res.ok) {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await res.json();
          setVendors(data.vendors || []);
          setStock(data.stock || []);
          setSales(data.sales || []);
          setTrades(data.trades || []);
          setCashouts(data.cashouts || []);
          setTradeIns(data.tradeIns || []);
          setRaffleEntries(data.raffleEntries || []);
          setRaffleHistory(data.raffleHistory || []);
          setLastSynced(new Date());
          setSyncError(null); // Clear errors on successful connection
        } else {
          if (!db) {
            setSyncError("Network Sync response was invalid");
          }
        }
      } else {
        if (!db) {
          setSyncError(`Failed to fetch state: Server Error ${res.status}`);
        }
      }
    } catch (err: any) {
      console.error("Error synchronizing with state database", err);
      if (!db) {
        setSyncError(err.message || "Network Sync failed");
      }
    } finally {
      if (!silent) {
        setIsSyncing(false);
      }
      setIsLoadingState(false);
    }
  };

  useEffect(() => {
    // Restore login session from localStorage if available
    const savedUser = localStorage.getItem('newtons_session_user');
    const savedRole = localStorage.getItem('newtons_session_role');
    if (savedUser && savedRole) {
      setCurrentUser(JSON.parse(savedUser));
      setUserRole(savedRole as 'vendor' | 'admin');
      setActiveTab(savedRole === 'admin' ? 'admin' : 'home');
    }

    let unsubscribeFirestore: (() => void) | null = null;
    let fallbackInterval: NodeJS.Timeout | null = null;

    if (db) {
      try {
        console.log("Connecting directly to Firestore for stable real-time synchronization...");
        const collectionRef = collection(db, "marketState");
        
        unsubscribeFirestore = onSnapshot(collectionRef, (snap) => {
          let updatedKeys = new Set<string>();
          snap.forEach((doc) => {
            const key = doc.id;
            const val = doc.data()?.data;
            if (val && Array.isArray(val)) {
              if (key === "vendors") setVendors(val);
              else if (key === "stock") setStock(val);
              else if (key === "sales") setSales(val);
              else if (key === "trades") setTrades(val);
              else if (key === "cashouts") setCashouts(val);
              else if (key === "tradeIns") setTradeIns(val);
              else if (key === "raffleEntries") setRaffleEntries(val);
              else if (key === "raffleHistory") setRaffleHistory(val);
              updatedKeys.add(key);
            }
          });
          
          if (updatedKeys.size > 0) {
            setLastSynced(new Date());
            setSyncError(null);
            setIsLoadingState(false);
            setSyncMode('realtime');
          }
        }, (err) => {
          console.error("Firestore onSnapshot error, falling back to REST polling:", err);
          setSyncError("Live sync interrupted. Reconnecting...");
          setSyncMode('polling');
          // Fallback if listener fails
          refreshAppState(true);
        });
      } catch (err: any) {
        console.error("Error setting up real-time Firestore listener:", err);
        setSyncError("Direct live sync unavailable. Polling fallback active.");
        setSyncMode('polling');
      }
    } else {
      setSyncMode('polling');
    }

    // High reliability background synchronization (serves as fallback or bootstrap)
    const runSyncFallback = () => {
      // Fetch initial state once, then poll gently every 25 seconds just as a fail-safe
      refreshAppState(true);
    };

    // Run initial fetch immediately
    refreshAppState();

    // Setup fail-safe background sync interval
    fallbackInterval = setInterval(runSyncFallback, 25000);

    // Support tab/app visibility changes
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshAppState(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (unsubscribeFirestore) {
        unsubscribeFirestore();
      }
      if (fallbackInterval) {
        clearInterval(fallbackInterval);
      }
    };
  }, []);

  // Synchronize current logged-in vendor state if vendors array is modified from Firestore
  useEffect(() => {
    if (currentUser && userRole === 'vendor') {
      const updatedMe = vendors.find((v) => v.id === currentUser.id);
      if (updatedMe) {
        if (JSON.stringify(updatedMe) !== JSON.stringify(currentUser)) {
          setCurrentUser(updatedMe);
          localStorage.setItem('newtons_session_user', JSON.stringify(updatedMe));
        }
      }
    }
  }, [vendors, currentUser, userRole]);

  // Update localStorage session on state changes
  const handleLoginSuccess = (user: any, role: 'vendor' | 'admin') => {
    setCurrentUser(user);
    setUserRole(role);
    localStorage.setItem('newtons_session_user', JSON.stringify(user));
    localStorage.setItem('newtons_session_role', role);
    setActiveTab(role === 'admin' ? 'admin' : 'home');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setUserRole(null);
    setAdminViewingVendorId(null);
    localStorage.removeItem('newtons_session_user');
    localStorage.removeItem('newtons_session_role');
    setActiveTab('staff');
    setPinError(null);
    setMobileMenuOpen(false);
  };

  // Submit Authorization PIN
  const handleLoginSubmit = async (pin: string) => {
    setAuthLoading(true);
    setPinError(null);

    // If Firestore direct sync is active, validate local/cached state to ensure zero-downtime offline login
    if (db && vendors.length > 0) {
      try {
        if (pin === "9999") {
          handleLoginSuccess({ id: "master", name: "Newton (Master Control)" }, 'admin');
          setAuthLoading(false);
          return;
        }
        const foundVendor = vendors.find(v => v.pin === pin);
        if (foundVendor) {
          handleLoginSuccess(foundVendor, 'vendor');
          setAuthLoading(false);
          return;
        } else {
          setPinError("Invalid PIN. Please try again.");
          setAuthLoading(false);
          return;
        }
      } catch (err) {
        console.warn("Direct Firestore auth validation failed, falling back to network REST API:", err);
      }
    }

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      });

      let errMsg = "Login authorization failed.";
      let data: any = null;

      try {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          data = await res.json();
        }
      } catch (e) {
        console.warn("Failed to parse JSON for login response", e);
      }

      if (res.ok && data) {
        await refreshAppState();
        if (data.role === 'admin') {
          handleLoginSuccess(data.user, 'admin');
        } else {
          handleLoginSuccess(data.user, 'vendor');
        }
      } else {
        setPinError(data?.error || `Server Error (${res.status}): ${res.statusText || errMsg}`);
      }
    } catch (err) {
      setPinError("Could not connect to secure authentication server.");
    } finally {
      setAuthLoading(false);
    }
  };

  // Log a sale from Joint Register
  const handleLogSale = async (saleData: {
    vendorId: string;
    itemName?: string;
    stockItemId?: string | null;
    price?: number;
    date: string;
    items?: Array<{
      itemName: string;
      stockItemId: string | null;
      price: number;
      vendorId?: string;
    }>;
    tradeIn?: {
      details: string;
      amount: number;
    };
  }) => {
    if (db) {
      try {
        const updatedVendors = [...vendors];
        const targetVendor = updatedVendors.find(v => v.id === saleData.vendorId);
        if (targetVendor || saleData.items?.length) {
          const updatedSales = [...sales];
          const updatedStock = [...stock];
          const updatedTradeIns = [...tradeIns];

          const itemsToProcess = saleData.items || [];
          if (itemsToProcess.length === 0 && (saleData.itemName || saleData.price !== undefined)) {
            itemsToProcess.push({
              itemName: saleData.itemName || '',
              stockItemId: saleData.stockItemId || null,
              price: saleData.price || 0,
              vendorId: saleData.vendorId
            });
          }

          for (let i = 0; i < itemsToProcess.length; i++) {
            const item = itemsToProcess[i];
            const itemVendorId = item.vendorId || saleData.vendorId;
            const itemVendor = updatedVendors.find(v => v.id === itemVendorId) || targetVendor;
            if (!itemVendor) continue;

            const salePrice = Number(item.price);
            const commRate = itemVendor.commission;
            const commAmount = Number((salePrice * commRate).toFixed(2));
            const earnings = Number((salePrice - commAmount).toFixed(2));

            if (item.stockItemId) {
              const stockItemIndex = updatedStock.findIndex(s => s.id === item.stockItemId);
              if (stockItemIndex !== -1) {
                const currentQty = updatedStock[stockItemIndex].quantity;
                updatedStock[stockItemIndex] = {
                  ...updatedStock[stockItemIndex],
                  quantity: currentQty > 1 ? currentQty - 1 : 0
                };
              }
            }

            const newSale: Sale = {
              id: "sale_" + Date.now() + "_" + Math.floor(Math.random() * 100000) + "_" + i,
              vendorId: itemVendorId,
              vendorName: itemVendor.name,
              itemName: item.itemName,
              stockItemId: item.stockItemId || null,
              price: salePrice,
              commissionAmount: commAmount,
              vendorEarnings: earnings,
              date: saleData.date || new Date().toISOString(),
              cashedOut: false,
              cashoutRequestId: null,
            };
            updatedSales.push(newSale);
          }

          if (saleData.tradeIn) {
            const tradeInAmount = Number(saleData.tradeIn.amount);
            if (!isNaN(tradeInAmount) && tradeInAmount > 0) {
              targetVendor.tradeCredit = Number((targetVendor.tradeCredit - tradeInAmount).toFixed(2));
              const newTradeIn: TradeIn = {
                id: "tradein_" + Date.now() + "_" + Math.floor(Math.random() * 10000),
                vendorId: saleData.vendorId,
                vendorName: targetVendor.name,
                details: "[Register Trade-In] " + saleData.tradeIn.details,
                estimatedValue: tradeInAmount,
                creditApplied: -tradeInAmount,
                status: "approved",
                date: saleData.date || new Date().toISOString()
              };
              updatedTradeIns.push(newTradeIn);
            }
          }

          await setDoc(doc(db, "marketState", "sales"), { data: updatedSales });
          await setDoc(doc(db, "marketState", "stock"), { data: updatedStock });
          if (saleData.tradeIn) {
            await setDoc(doc(db, "marketState", "tradeIns"), { data: updatedTradeIns });
            await setDoc(doc(db, "marketState", "vendors"), { data: updatedVendors });
          }
          return;
        }
      } catch (err) {
        console.warn("Direct Firestore write failed for log sale, falling back to REST:", err);
      }
    }

    const res = await fetch('/api/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(saleData)
    });

    if (!res.ok) {
      let errMsg = "Failed to log register sale.";
      try {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await res.json();
          errMsg = data.error || errMsg;
        } else {
          errMsg = `Server Error (${res.status}): ${res.statusText || 'Unexpected Response format'}`;
        }
      } catch (e) {
        errMsg = `Server Error (${res.status}): ${res.statusText || 'Unexpected error'}`;
      }
      throw new Error(errMsg);
    }

    await refreshAppState();
  };

  // Add stock to catalog
  const handleAddStock = async (stockData: {
    id?: string;
    name: string;
    price: number;
    vendorId: string;
    quantity: number;
    rarity: string;
    setName: string;
    imageUrl?: string;
  }) => {
    if (db) {
      try {
        const updatedStock = [...stock];
        const vendor = vendors.find(v => v.id === stockData.vendorId);
        const vendorName = vendor ? vendor.name : "N/A";

        if (stockData.id) {
          const index = updatedStock.findIndex(s => s.id === stockData.id);
          if (index !== -1) {
            updatedStock[index] = {
              ...updatedStock[index],
              id: stockData.id,
              name: stockData.name,
              price: Number(stockData.price),
              vendorId: stockData.vendorId,
              vendorName: vendorName,
              quantity: Number(stockData.quantity) || 1,
              rarity: stockData.rarity || "Common",
              setName: stockData.setName || "N/A",
              imageUrl: stockData.imageUrl || ""
            };
          }
        } else {
          const newStock: StockItem = {
            id: "stock_" + Date.now() + "_" + Math.floor(Math.random() * 10000),
            name: stockData.name,
            price: Number(stockData.price),
            vendorId: stockData.vendorId,
            vendorName: vendorName,
            quantity: Number(stockData.quantity) || 1,
            rarity: stockData.rarity || "Common",
            setName: stockData.setName || "N/A",
            imageUrl: stockData.imageUrl || "",
            dateAdded: new Date().toISOString()
          };
          updatedStock.push(newStock);
        }
        await setDoc(doc(db, "marketState", "stock"), { data: updatedStock });
        return;
      } catch (err) {
        console.warn("Direct Firestore write failed for stock, falling back to REST:", err);
      }
    }

    const res = await fetch('/api/stock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(stockData)
    });

    if (!res.ok) {
      let errMsg = "Failed to update stock catalog.";
      try {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await res.json();
          errMsg = data.error || errMsg;
        } else {
          errMsg = `Server Error (${res.status}): ${res.statusText || 'Unexpected Response format'}`;
        }
      } catch (e) {
        errMsg = `Server Error (${res.status}): ${res.statusText || 'Unexpected error'}`;
      }
      throw new Error(errMsg);
    }

    await refreshAppState();
  };

  // Propose card trade
  const handleProposeTrade = async (tradeData: {
    proposerId: string;
    receiverId: string;
    offeredItemNames: string;
    requestedItemNames: string;
    offeredCash: number;
    imageUrl?: string;
    notes?: string;
  }) => {
    if (db) {
      try {
        const proposer = vendors.find(v => v.id === tradeData.proposerId);
        const receiver = vendors.find(v => v.id === tradeData.receiverId);
        if (proposer && receiver) {
          const updatedTrades = [...trades];
          const newTrade: TradeProposal = {
            id: "trade_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
            proposerId: tradeData.proposerId,
            proposerName: proposer.name,
            receiverId: tradeData.receiverId,
            receiverName: receiver.name,
            offeredItemNames: tradeData.offeredItemNames,
            requestedItemNames: tradeData.requestedItemNames,
            offeredCash: Number(tradeData.offeredCash) || 0,
            status: "pending",
            imageUrl: tradeData.imageUrl || "",
            notes: tradeData.notes || "",
            date: new Date().toISOString()
          };
          updatedTrades.push(newTrade);
          await setDoc(doc(db, "marketState", "trades"), { data: updatedTrades });
          return;
        }
      } catch (err) {
        console.warn("Direct Firestore write failed for trade, falling back to REST:", err);
      }
    }

    const res = await fetch('/api/trades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tradeData)
    });

    if (!res.ok) {
      let errMsg = "Failed to transmit swap proposal.";
      try {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await res.json();
          errMsg = data.error || errMsg;
        } else {
          errMsg = `Server Error (${res.status}): ${res.statusText || 'Unexpected Response format'}`;
        }
      } catch (e) {
        errMsg = `Server Error (${res.status}): ${res.statusText || 'Unexpected error'}`;
      }
      throw new Error(errMsg);
    }

    await refreshAppState();
  };

  // Respond to trade
  const handleRespondTrade = async (
    tradeId: string,
    status: 'accepted' | 'declined' | 'countered',
    responseDetails?: {
      notes?: string;
      counterOfferedItemNames?: string;
      counterRequestedItemNames?: string;
      counterOfferedCash?: number;
    }
  ) => {
    if (db) {
      try {
        const updatedTrades = [...trades];
        const updatedVendors = [...vendors];
        const tradeIndex = updatedTrades.findIndex(t => t.id === tradeId);

        if (tradeIndex !== -1) {
          const trade = { ...updatedTrades[tradeIndex] };
          
          if (status === "accepted") {
            trade.status = "accepted";
            if (responseDetails?.notes) trade.notes = responseDetails.notes;

            if (trade.offeredCash > 0) {
              const pIndex = updatedVendors.findIndex(v => v.id === trade.proposerId);
              const rIndex = updatedVendors.findIndex(v => v.id === trade.receiverId);
              if (pIndex !== -1 && rIndex !== -1) {
                updatedVendors[pIndex] = {
                  ...updatedVendors[pIndex],
                  tradeCredit: Number((updatedVendors[pIndex].tradeCredit - trade.offeredCash).toFixed(2))
                };
                updatedVendors[rIndex] = {
                  ...updatedVendors[rIndex],
                  tradeCredit: Number((updatedVendors[rIndex].tradeCredit + trade.offeredCash).toFixed(2))
                };
              }
            }
            updatedTrades[tradeIndex] = trade;
          } else if (status === "declined") {
            trade.status = "declined";
            if (responseDetails?.notes) trade.notes = responseDetails.notes;
            updatedTrades[tradeIndex] = trade;
          } else if (status === "countered") {
            trade.status = "countered";
            updatedTrades[tradeIndex] = trade;

            const newCounterTrade: TradeProposal = {
              id: "trade_" + Date.now() + "_counter",
              proposerId: trade.receiverId,
              proposerName: trade.receiverName,
              receiverId: trade.proposerId,
              receiverName: trade.proposerName,
              offeredItemNames: responseDetails?.counterOfferedItemNames || trade.requestedItemNames,
              requestedItemNames: responseDetails?.counterRequestedItemNames || trade.offeredItemNames,
              offeredCash: Number(responseDetails?.counterOfferedCash) || 0,
              imageUrl: trade.imageUrl,
              status: "pending",
              date: new Date().toISOString(),
              notes: responseDetails?.notes || `Counter offer for previous trade: ${trade.id}`
            };
            updatedTrades.push(newCounterTrade);
          }

          await setDoc(doc(db, "marketState", "trades"), { data: updatedTrades });
          if (status === "accepted") {
            await setDoc(doc(db, "marketState", "vendors"), { data: updatedVendors });
            if (currentUser && userRole === 'vendor') {
              const updatedMe = updatedVendors.find(v => v.id === currentUser.id);
              if (updatedMe) {
                setCurrentUser(updatedMe);
                localStorage.setItem('newtons_session_user', JSON.stringify(updatedMe));
              }
            }
          }
          return;
        }
      } catch (err) {
        console.warn("Direct Firestore write failed for trade respond, falling back to REST:", err);
      }
    }

    const res = await fetch(`/api/trades/${tradeId}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, ...responseDetails })
    });

    if (!res.ok) {
      let errMsg = "Failed to transmit trade response.";
      try {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await res.json();
          errMsg = data.error || errMsg;
        } else {
          errMsg = `Server Error (${res.status}): ${res.statusText || 'Unexpected Response format'}`;
        }
      } catch (e) {
        errMsg = `Server Error (${res.status}): ${res.statusText || 'Unexpected error'}`;
      }
      throw new Error(errMsg);
    }

    await refreshAppState();
    
    // In case trade credit was exchanged, refresh the current vendor's cache
    if (currentUser && userRole === 'vendor') {
      const latestVendorsRes = await fetch('/api/state');
      if (latestVendorsRes.ok) {
        const latestState = await latestVendorsRes.json();
        const updatedMe = latestState.vendors.find((v: Vendor) => v.id === currentUser.id);
        if (updatedMe) {
          setCurrentUser(updatedMe);
          localStorage.setItem('newtons_session_user', JSON.stringify(updatedMe));
        }
      }
    }
  };

  // Request cashout
  const handleRequestCashout = async (vendorId: string, amount: number) => {
    const reqAmount = Number(amount);
    if (isNaN(reqAmount) || reqAmount <= 0) return;

    if (db) {
      try {
        const vendor = vendors.find(v => v.id === vendorId);
        if (vendor) {
          const updatedCashouts = [...cashouts];
          const updatedSales = [...sales];
          const reqId = "req_" + Date.now();

          const newRequest: CashoutRequest = {
            id: reqId,
            vendorId,
            vendorName: vendor.name,
            amount: reqAmount,
            date: new Date().toISOString(),
            status: "pending"
          };

          let accumulatedEarnings = 0;
          updatedSales.forEach((sale, index) => {
            if (
              sale.vendorId === vendorId &&
              !sale.cashedOut &&
              !sale.cashoutRequestId &&
              isSaleMature(sale.date, new Date())
            ) {
              if (accumulatedEarnings < reqAmount) {
                updatedSales[index] = {
                  ...sale,
                  cashoutRequestId: reqId
                };
                accumulatedEarnings += sale.vendorEarnings;
              }
            }
          });

          updatedCashouts.push(newRequest);

          await setDoc(doc(db, "marketState", "cashouts"), { data: updatedCashouts });
          await setDoc(doc(db, "marketState", "sales"), { data: updatedSales });
          return;
        }
      } catch (err) {
        console.warn("Direct Firestore write failed for cashout, falling back to REST:", err);
      }
    }

    const res = await fetch('/api/cashouts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vendorId, amount: reqAmount })
    });

    if (!res.ok) {
      let errMsg = "Failed to submit cash out hold release.";
      try {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await res.json();
          errMsg = data.error || errMsg;
        } else {
          errMsg = `Server Error (${res.status}): ${res.statusText || 'Unexpected Response format'}`;
        }
      } catch (e) {
        errMsg = `Server Error (${res.status}): ${res.statusText || 'Unexpected error'}`;
      }
      throw new Error(errMsg);
    }

    await refreshAppState();
  };

  // Add a Trade-In
  const handleAddTradeIn = async (tradeInData: {
    vendorId: string;
    details: string;
    estimatedValue: number;
    creditApplied: number;
  }) => {
    if (db) {
      try {
        const vendor = vendors.find(v => v.id === tradeInData.vendorId);
        if (vendor) {
          const updatedTradeIns = [...tradeIns];
          const newTradeIn: TradeIn = {
            id: "tradein_" + Date.now(),
            vendorId: tradeInData.vendorId,
            vendorName: vendor.name,
            details: tradeInData.details,
            estimatedValue: Number(tradeInData.estimatedValue),
            creditApplied: Number(tradeInData.creditApplied) || Number(tradeInData.estimatedValue),
            status: "pending",
            date: new Date().toISOString()
          };
          updatedTradeIns.push(newTradeIn);
          await setDoc(doc(db, "marketState", "tradeIns"), { data: updatedTradeIns });
          return;
        }
      } catch (err) {
        console.warn("Direct Firestore write failed for trade-in, falling back to REST:", err);
      }
    }

    const res = await fetch('/api/trade-ins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tradeInData)
    });

    if (!res.ok) {
      let errMsg = "Failed to transmit trade-in details.";
      try {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await res.json();
          errMsg = data.error || errMsg;
        } else {
          errMsg = `Server Error (${res.status}): ${res.statusText || 'Unexpected Response format'}`;
        }
      } catch (e) {
        errMsg = `Server Error (${res.status}): ${res.statusText || 'Unexpected error'}`;
      }
      throw new Error(errMsg);
    }

    await refreshAppState();
  };

  // Admin: Update vendor
  const handleUpdateVendor = async (vendorData: {
    id: string;
    name: string;
    pin: string;
    commission: number;
    color?: string;
  }) => {
    if (db) {
      try {
        const updatedVendors = [...vendors];
        const targetId = vendorData.id && vendorData.id.trim() !== "" ? vendorData.id : null;

        if (targetId) {
          const index = updatedVendors.findIndex(v => v.id === targetId);
          if (index !== -1) {
            updatedVendors[index] = {
              ...updatedVendors[index],
              name: vendorData.name,
              pin: vendorData.pin,
              commission: Number(vendorData.commission),
              color: vendorData.color || updatedVendors[index].color
            };
          }
        } else {
          const newVendorId = "v_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
          const newVendor: Vendor = {
            id: newVendorId,
            name: vendorData.name,
            pin: vendorData.pin,
            commission: Number(vendorData.commission) || 0.10,
            tradeCredit: 0.0,
            color: vendorData.color || "#64748B"
          };
          updatedVendors.push(newVendor);
        }

        await setDoc(doc(db, "marketState", "vendors"), { data: updatedVendors });
        return;
      } catch (err) {
        console.warn("Direct Firestore write failed for vendor update, falling back to REST:", err);
      }
    }

    const res = await fetch('/api/admin/vendors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(vendorData)
    });

    if (!res.ok) {
      let errMsg = "Failed to update vendor structures.";
      try {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await res.json();
          errMsg = data.error || errMsg;
        } else {
          errMsg = `Server Error (${res.status}): ${res.statusText || 'Unexpected Response format'}`;
        }
      } catch (e) {
        errMsg = `Server Error (${res.status}): ${res.statusText || 'Unexpected error'}`;
      }
      throw new Error(errMsg);
    }

    await refreshAppState();
  };

  // Admin: Update sale
  const handleUpdateSale = async (saleId: string, saleData: {
    vendorId: string;
    itemName: string;
    price: number;
    date: string;
  }) => {
    if (db) {
      try {
        const updatedSales = [...sales];
        const saleIndex = updatedSales.findIndex(s => s.id === saleId);
        const vendor = vendors.find(v => v.id === saleData.vendorId);

        if (saleIndex !== -1 && vendor) {
          const salePrice = Number(saleData.price);
          const commRate = vendor.commission;
          const commAmount = Number((salePrice * commRate).toFixed(2));
          const earnings = Number((salePrice - commAmount).toFixed(2));

          updatedSales[saleIndex] = {
            ...updatedSales[saleIndex],
            vendorId: saleData.vendorId,
            vendorName: vendor.name,
            itemName: saleData.itemName,
            price: salePrice,
            commissionAmount: commAmount,
            vendorEarnings: earnings,
            date: saleData.date || updatedSales[saleIndex].date
          };

          await setDoc(doc(db, "marketState", "sales"), { data: updatedSales });
          return;
        }
      } catch (err) {
        console.warn("Direct Firestore write failed for sale update, falling back to REST:", err);
      }
    }

    const res = await fetch(`/api/admin/sales/${saleId}/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(saleData)
    });

    if (!res.ok) {
      let errMsg = "Failed to update sale.";
      try {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await res.json();
          errMsg = data.error || errMsg;
        } else {
          errMsg = `Server Error (${res.status}): ${res.statusText || 'Unexpected Response format'}`;
        }
      } catch (e) {
        errMsg = `Server Error (${res.status}): ${res.statusText || 'Unexpected error'}`;
      }
      throw new Error(errMsg);
    }

    await refreshAppState();
  };

  // Admin: Delete sale
  const handleDeleteSale = async (saleId: string) => {
    if (db) {
      try {
        const updatedSales = [...sales];
        const updatedStock = [...stock];
        const saleIndex = updatedSales.findIndex(s => s.id === saleId);

        if (saleIndex !== -1) {
          const sale = updatedSales[saleIndex];
          if (sale.stockItemId) {
            const stockIndex = updatedStock.findIndex(s => s.id === sale.stockItemId);
            if (stockIndex !== -1) {
              updatedStock[stockIndex] = {
                ...updatedStock[stockIndex],
                quantity: updatedStock[stockIndex].quantity + 1
              };
            }
          }

          updatedSales.splice(saleIndex, 1);

          await setDoc(doc(db, "marketState", "sales"), { data: updatedSales });
          if (sale.stockItemId) {
            await setDoc(doc(db, "marketState", "stock"), { data: updatedStock });
          }
          return;
        }
      } catch (err) {
        console.warn("Direct Firestore write failed for sale delete, falling back to REST:", err);
      }
    }

    const res = await fetch(`/api/admin/sales/${saleId}/delete`, {
      method: 'POST'
    });

    if (!res.ok) {
      let errMsg = "Failed to delete sale.";
      try {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await res.json();
          errMsg = data.error || errMsg;
        } else {
          errMsg = `Server Error (${res.status}): ${res.statusText || 'Unexpected Response format'}`;
        }
      } catch (e) {
        errMsg = `Server Error (${res.status}): ${res.statusText || 'Unexpected error'}`;
      }
      throw new Error(errMsg);
    }

    await refreshAppState();
  };

  // Admin: Update requested cashout amount
  const handleUpdateCashoutAmount = async (cashoutId: string, newAmount: number) => {
    const amt = Number(newAmount);
    if (isNaN(amt) || amt <= 0) return;

    if (db) {
      try {
        const updatedCashouts = [...cashouts];
        const updatedSales = [...sales];
        const reqIndex = updatedCashouts.findIndex(r => r.id === cashoutId);

        if (reqIndex !== -1) {
          const reqObj = updatedCashouts[reqIndex];
          const orig = reqObj.originalAmount ?? reqObj.amount;
          updatedCashouts[reqIndex] = {
            ...reqObj,
            amount: amt,
            originalAmount: orig
          };

          // Untag all sales currently tagged with this request
          updatedSales.forEach((sale, index) => {
            if (sale.cashoutRequestId === cashoutId) {
              updatedSales[index] = { ...sale, cashoutRequestId: null };
            }
          });

          // Re-tag sales for this vendor up to newAmount
          let accumulated = 0;
          updatedSales.forEach((sale, index) => {
            if (
              sale.vendorId === reqObj.vendorId &&
              !sale.cashedOut &&
              !sale.cashoutRequestId &&
              isSaleMature(sale.date, new Date())
            ) {
              if (accumulated < amt) {
                updatedSales[index] = { ...sale, cashoutRequestId: cashoutId };
                accumulated += sale.vendorEarnings;
              }
            }
          });

          await setDoc(doc(db, "marketState", "cashouts"), { data: updatedCashouts });
          await setDoc(doc(db, "marketState", "sales"), { data: updatedSales });
          return;
        }
      } catch (err) {
        console.warn("Direct Firestore write failed for cashout update, falling back to REST:", err);
      }
    }

    const res = await fetch(`/api/admin/cashouts/${cashoutId}/update-amount`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: amt })
    });

    if (!res.ok) {
      let errMsg = "Failed to update cash out amount.";
      try {
        const data = await res.json();
        errMsg = data.error || errMsg;
      } catch (e) {}
      throw new Error(errMsg);
    }

    await refreshAppState();
  };

  // Admin: Approve / Decline cashout
  const handleRespondCashout = async (cashoutId: string, status: 'approved' | 'declined', newAmount?: number) => {
    if (db) {
      try {
        const updatedCashouts = [...cashouts];
        const updatedSales = [...sales];
        const reqIndex = updatedCashouts.findIndex(r => r.id === cashoutId);

        if (reqIndex !== -1) {
          const currentReq = updatedCashouts[reqIndex];
          const finalAmount = newAmount !== undefined && newAmount > 0 ? Number(newAmount) : currentReq.amount;
          const orig = newAmount !== undefined && newAmount !== currentReq.amount ? (currentReq.originalAmount ?? currentReq.amount) : currentReq.originalAmount;

          updatedCashouts[reqIndex] = {
            ...currentReq,
            amount: finalAmount,
            originalAmount: orig,
            status,
            payoutDate: status === "approved" ? new Date().toISOString() : undefined
          };

          if (status === "approved") {
            let sumPaid = 0;
            updatedSales.forEach((sale, index) => {
              if (sale.cashoutRequestId === cashoutId) {
                if (sumPaid < finalAmount) {
                  updatedSales[index] = {
                    ...sale,
                    cashedOut: true,
                    cashoutRequestId: cashoutId
                  };
                  sumPaid += sale.vendorEarnings;
                } else {
                  // Any excess sale exceeding the approved amount is released back to vendor's bank balance
                  updatedSales[index] = {
                    ...sale,
                    cashedOut: false,
                    cashoutRequestId: null
                  };
                }
              }
            });
          } else {
            // Declined: release all sales back to vendor bank balance
            updatedSales.forEach((sale, index) => {
              if (sale.cashoutRequestId === cashoutId) {
                updatedSales[index] = {
                  ...sale,
                  cashedOut: false,
                  cashoutRequestId: null
                };
              }
            });
          }

          await setDoc(doc(db, "marketState", "cashouts"), { data: updatedCashouts });
          await setDoc(doc(db, "marketState", "sales"), { data: updatedSales });
          return;
        }
      } catch (err) {
        console.warn("Direct Firestore write failed for cashout response, falling back to REST:", err);
      }
    }

    const res = await fetch(`/api/admin/cashouts/${cashoutId}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, amount: newAmount })
    });

    if (!res.ok) {
      let errMsg = "Failed to register payout response.";
      try {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await res.json();
          errMsg = data.error || errMsg;
        } else {
          errMsg = `Server Error (${res.status}): ${res.statusText || 'Unexpected Response format'}`;
        }
      } catch (e) {
        errMsg = `Server Error (${res.status}): ${res.statusText || 'Unexpected error'}`;
      }
      throw new Error(errMsg);
    }

    await refreshAppState();
  };

  // Admin: Approve trade-in
  const handleRespondTradeIn = async (tradeInId: string, status: 'approved' | 'declined', finalCredit?: number) => {
    if (db) {
      try {
        const updatedTradeIns = [...tradeIns];
        const updatedVendors = [...vendors];
        const trIndex = updatedTradeIns.findIndex(t => t.id === tradeInId);

        if (trIndex !== -1) {
          const tradeIn = { ...updatedTradeIns[trIndex] };
          tradeIn.status = status;

          if (status === "approved") {
            const credit = finalCredit !== undefined ? Number(finalCredit) : tradeIn.creditApplied;
            tradeIn.creditApplied = credit;

            const vendorIndex = updatedVendors.findIndex(v => v.id === tradeIn.vendorId);
            if (vendorIndex !== -1) {
              updatedVendors[vendorIndex] = {
                ...updatedVendors[vendorIndex],
                tradeCredit: Number((updatedVendors[vendorIndex].tradeCredit + credit).toFixed(2))
              };
            }
          }
          updatedTradeIns[trIndex] = tradeIn;

          await setDoc(doc(db, "marketState", "tradeIns"), { data: updatedTradeIns });
          if (status === "approved") {
            await setDoc(doc(db, "marketState", "vendors"), { data: updatedVendors });
          }
          return;
        }
      } catch (err) {
        console.warn("Direct Firestore write failed for trade-in response, falling back to REST:", err);
      }
    }

    const res = await fetch(`/api/admin/trade-ins/${tradeInId}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, finalCredit })
    });

    if (!res.ok) {
      let errMsg = "Failed to register trade-in response.";
      try {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await res.json();
          errMsg = data.error || errMsg;
        } else {
          errMsg = `Server Error (${res.status}): ${res.statusText || 'Unexpected Response format'}`;
        }
      } catch (e) {
        errMsg = `Server Error (${res.status}): ${res.statusText || 'Unexpected error'}`;
      }
      throw new Error(errMsg);
    }

    await refreshAppState();
  };

  // Raffle Handlers
  const handleAddRaffleEntry = async (entryData: { name: string; ticketCount: number; phoneOrNote?: string }) => {
    if (db) {
      try {
        const updatedEntries = [...raffleEntries];
        const currentTotal = updatedEntries.reduce((sum, e) => sum + (e.ticketCount || 0), 0);
        const count = Number(entryData.ticketCount) || 1;
        const newEntry: RaffleEntry = {
          id: "raffle_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
          name: entryData.name.trim(),
          ticketCount: count,
          dateAdded: new Date().toISOString(),
          ticketRangeStart: currentTotal + 1,
          ticketRangeEnd: currentTotal + count,
          phoneOrNote: entryData.phoneOrNote
        };
        updatedEntries.push(newEntry);
        setRaffleEntries(updatedEntries);
        await setDoc(doc(db, "marketState", "raffleEntries"), { data: updatedEntries });
        return;
      } catch (err) {
        console.warn("Direct Firestore write failed for raffle entry, falling back to REST:", err);
      }
    }

    const res = await fetch('/api/raffle/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entryData)
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Failed to add raffle entry");
    }
    await refreshAppState();
  };

  const handleDeleteRaffleEntry = async (entryId: string) => {
    if (db) {
      try {
        let updatedEntries = raffleEntries.filter(e => e.id !== entryId);
        let running = 0;
        updatedEntries = updatedEntries.map(e => {
          const start = running + 1;
          const end = running + e.ticketCount;
          running += e.ticketCount;
          return { ...e, ticketRangeStart: start, ticketRangeEnd: end };
        });
        setRaffleEntries(updatedEntries);
        await setDoc(doc(db, "marketState", "raffleEntries"), { data: updatedEntries });
        return;
      } catch (err) {
        console.warn("Direct Firestore write failed for raffle delete, falling back to REST:", err);
      }
    }

    const res = await fetch(`/api/raffle/entries/${entryId}`, {
      method: 'DELETE'
    });
    if (!res.ok) {
      throw new Error("Failed to delete raffle entry");
    }
    await refreshAppState();
  };

  const handleUpdateRaffleEntry = async (entryId: string, name: string, ticketCount: number) => {
    if (db) {
      try {
        let updatedEntries = raffleEntries.map(e => {
          if (e.id === entryId) {
            return { ...e, name, ticketCount };
          }
          return e;
        });
        let running = 0;
        updatedEntries = updatedEntries.map(e => {
          const start = running + 1;
          const end = running + e.ticketCount;
          running += e.ticketCount;
          return { ...e, ticketRangeStart: start, ticketRangeEnd: end };
        });
        setRaffleEntries(updatedEntries);
        await setDoc(doc(db, "marketState", "raffleEntries"), { data: updatedEntries });
        return;
      } catch (err) {
        console.warn("Direct Firestore write failed for raffle update, falling back to REST:", err);
      }
    }

    const res = await fetch(`/api/raffle/entries/${entryId}/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, ticketCount })
    });
    if (!res.ok) {
      throw new Error("Failed to update raffle entry");
    }
    await refreshAppState();
  };

  const handleClearRaffleEntries = async () => {
    if (db) {
      try {
        setRaffleEntries([]);
        await setDoc(doc(db, "marketState", "raffleEntries"), { data: [] });
        return;
      } catch (err) {
        console.warn("Direct Firestore write failed for raffle clear, falling back to REST:", err);
      }
    }

    const res = await fetch('/api/raffle/clear', { method: 'POST' });
    if (!res.ok) {
      throw new Error("Failed to clear raffle entries");
    }
    await refreshAppState();
  };

  const handleSaveRaffleResult = async (resultData: {
    totalTickets: number;
    totalParticipants: number;
    prizeCount: number;
    winners: RaffleWinner[];
  }) => {
    if (db) {
      try {
        const newResult: RaffleDrawResult = {
          id: "draw_" + Date.now(),
          date: new Date().toISOString(),
          totalTickets: resultData.totalTickets,
          totalParticipants: resultData.totalParticipants,
          prizeCount: resultData.prizeCount,
          winners: resultData.winners
        };
        const updatedHistory = [newResult, ...raffleHistory].slice(0, 30);
        setRaffleHistory(updatedHistory);
        await setDoc(doc(db, "marketState", "raffleHistory"), { data: updatedHistory });
        return;
      } catch (err) {
        console.warn("Direct Firestore write failed for raffle history, falling back to REST:", err);
      }
    }

    const res = await fetch('/api/raffle/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(resultData)
    });
    if (!res.ok) {
      throw new Error("Failed to save raffle result");
    }
    await refreshAppState();
  };

  const handleDeleteRaffleHistory = async (historyId: string) => {
    if (db) {
      try {
        const updatedHistory = raffleHistory.filter(h => h.id !== historyId);
        setRaffleHistory(updatedHistory);
        await setDoc(doc(db, "marketState", "raffleHistory"), { data: updatedHistory });
        return;
      } catch (err) {
        console.warn("Direct Firestore write failed for raffle history delete, falling back to REST:", err);
      }
    }

    const res = await fetch(`/api/raffle/history/${historyId}`, {
      method: 'DELETE'
    });
    if (!res.ok) {
      throw new Error("Failed to delete raffle history item");
    }
    await refreshAppState();
  };

  // Main UI render logic
  if (isLoadingState) {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-zinc-500 font-medium">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs tracking-wider uppercase font-bold text-zinc-400">Loading Newton's Ledger...</span>
        </div>
      </div>
    );
  }

  // Active user details
  const activeVendorObject = adminViewingVendorId 
    ? vendors.find((v) => v.id === adminViewingVendorId)
    : (currentUser ? vendors.find((v) => v.id === currentUser.id) : null);

  // Dynamic Header & Wallpaper Theme resolution
  // 1. Control Master logged in (userRole === 'admin') -> Royal Burgundy / Maroon header, matching rich deep wine wallpaper
  // 2. Vendor logged in (userRole === 'vendor' && currentUser) -> Vendor's color header, matching tinted wallpaper
  // 3. No one logged in (!currentUser) -> White header, matching clean white wallpaper
  const getTheme = () => {
    if (userRole === 'admin') {
      return {
        mode: 'admin' as const,
        headerBg: '#7c1d36',
        headerBorder: 'border-rose-900/40',
        headerStyle: { backgroundColor: '#7c1d36' },
        wallpaperStyle: {
          backgroundColor: '#20050d',
          backgroundImage: 'radial-gradient(ellipse 90% 60% at 50% -10%, #7c1d36 0%, #20050d 60%, #120206 100%)',
          minHeight: '100vh',
        },
        containerText: 'text-rose-50',
        navActive: 'bg-white text-rose-950 font-bold shadow-xs border border-white/40',
        navInactive: 'text-rose-100/90 hover:bg-white/15 hover:text-white',
        roleText: 'text-rose-200 font-bold',
        nameText: 'text-white font-black',
        logoutBtn: 'p-2 bg-black/25 hover:bg-red-500/80 hover:text-white text-rose-100 rounded-lg transition-colors border border-white/20 cursor-pointer',
        mobileToggle: 'md:hidden p-2 text-white bg-black/25 hover:bg-black/40 rounded-lg transition-colors border border-white/20',
        mobileMenuBg: 'bg-[#20050d] border-rose-900/50 text-rose-100',
        mobileNavActive: 'bg-rose-900/80 text-white font-bold',
        mobileNavInactive: 'text-rose-200 hover:bg-rose-950/60',
        logoWrapper: 'p-1 bg-white/20 backdrop-blur rounded-lg border border-white/20',
      };
    }

    if (userRole === 'vendor' && currentUser) {
      const vendorColor = currentUser.color || '#3B82F6';
      
      // Determine luminance for dynamic text contrast
      let isDark = true;
      try {
        const hex = vendorColor.replace('#', '');
        if (hex.length === 6) {
          const r = parseInt(hex.substring(0, 2), 16) / 255;
          const g = parseInt(hex.substring(2, 4), 16) / 255;
          const b = parseInt(hex.substring(4, 6), 16) / 255;
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          isDark = lum < 0.65;
        }
      } catch (e) {
        isDark = true;
      }

      return {
        mode: 'vendor' as const,
        headerBg: vendorColor,
        headerBorder: isDark ? 'border-black/15' : 'border-black/10',
        headerStyle: { backgroundColor: vendorColor },
        wallpaperStyle: {
          backgroundColor: '#fafafa',
          backgroundImage: `radial-gradient(ellipse 90% 60% at 50% 0%, ${vendorColor}18 0%, #f8fafc 80%)`,
          minHeight: '100vh',
        },
        containerText: 'text-zinc-900',
        navActive: isDark 
          ? 'bg-white text-zinc-900 shadow-xs font-bold border border-white/40' 
          : 'bg-zinc-900 text-white shadow-xs font-bold',
        navInactive: isDark
          ? 'text-white/90 hover:bg-white/20 hover:text-white'
          : 'text-zinc-800 hover:bg-black/10 hover:text-zinc-950',
        roleText: isDark ? 'text-white/75' : 'text-zinc-600',
        nameText: isDark ? 'text-white' : 'text-zinc-900',
        logoutBtn: isDark
          ? 'p-2 bg-black/20 hover:bg-red-500/80 hover:text-white text-white rounded-lg transition-colors border border-white/20 cursor-pointer'
          : 'p-2 bg-white/60 hover:bg-red-50 hover:text-red-600 text-zinc-700 rounded-lg transition-colors border border-black/10 cursor-pointer',
        mobileToggle: isDark
          ? 'md:hidden p-2 text-white bg-black/20 hover:bg-black/30 rounded-lg transition-colors border border-white/20'
          : 'md:hidden p-2 text-zinc-800 bg-white/60 hover:bg-white/90 rounded-lg transition-colors border border-black/10',
        mobileMenuBg: 'bg-white border-zinc-200 text-zinc-900',
        mobileNavActive: 'bg-zinc-100 text-zinc-900 font-bold',
        mobileNavInactive: 'text-zinc-600 hover:bg-zinc-50',
        logoWrapper: isDark ? 'p-1 bg-white/15 backdrop-blur rounded-lg' : '',
      };
    }

    // No one logged in -> White header and clean white wallpaper
    return {
      mode: 'guest' as const,
      headerBg: '#ffffff',
      headerBorder: 'border-zinc-200',
      headerStyle: { backgroundColor: '#ffffff' },
      wallpaperStyle: {
        backgroundColor: '#ffffff',
        backgroundImage: 'none',
        minHeight: '100vh',
      },
      containerText: 'text-zinc-900',
      navActive: 'bg-zinc-900 text-white font-bold shadow-xs',
      navInactive: 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900',
      roleText: 'text-zinc-400',
      nameText: 'text-zinc-900',
      logoutBtn: 'p-2 bg-zinc-50 hover:bg-red-50 hover:text-red-600 text-zinc-400 rounded-lg transition-colors border border-zinc-200/40 cursor-pointer',
      mobileToggle: 'md:hidden p-2 text-zinc-600 bg-zinc-50 hover:bg-zinc-100 rounded-lg transition-colors border border-zinc-200/50',
      mobileMenuBg: 'bg-white border-zinc-200 text-zinc-900',
      mobileNavActive: 'bg-zinc-100 text-blue-600 font-bold',
      mobileNavInactive: 'text-zinc-500 hover:bg-zinc-50',
      logoWrapper: '',
    };
  };

  const theme = getTheme();

  return (
    <div 
      className={`min-h-screen ${theme.containerText} flex flex-col font-sans transition-colors duration-300`}
      style={theme.wallpaperStyle}
    >
      {/* Dynamic Header Branding */}
      <header 
        className={`border-b ${theme.headerBorder} sticky top-0 z-40 shadow-xs transition-colors duration-300`}
        style={theme.headerStyle}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className={theme.logoWrapper}>
                <img 
                  src="https://i.ibb.co/ycn6KSLq/Untitled-28-June-2026-at-01-21-42-3.png" 
                  alt="Newton's Collectables" 
                  className="h-11 w-auto max-w-[180px] object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-1.5 text-xs font-semibold">
              {(userRole === 'vendor' || (userRole === 'admin' && adminViewingVendorId)) && (
                <>
                  <button
                    id="nav-tab-home"
                    onClick={() => setActiveTab('home')}
                    className={`px-3 py-2 rounded-md transition-all ${
                      activeTab === 'home' 
                        ? theme.navActive 
                        : theme.navInactive
                    }`}
                  >
                    Dashboard
                  </button>
                  <button
                    id="nav-tab-stock"
                    onClick={() => setActiveTab('stock')}
                    className={`px-3 py-2 rounded-md transition-all ${
                      activeTab === 'stock' 
                        ? theme.navActive 
                        : theme.navInactive
                    }`}
                  >
                    Stock Catalog
                  </button>
                  <button
                    id="nav-tab-payouts"
                    onClick={() => setActiveTab('payouts')}
                    className={`px-3 py-2 rounded-md transition-all ${
                      activeTab === 'payouts' 
                        ? theme.navActive 
                        : theme.navInactive
                    }`}
                  >
                    Payout & Trade-In
                  </button>
                </>
              )}

              {/* Shared Staff register */}
              <button
                id="nav-tab-staff"
                onClick={() => setActiveTab('staff')}
                className={`px-3 py-2 rounded-md transition-all flex items-center gap-1.5 ${
                  activeTab === 'staff' 
                    ? theme.navActive 
                    : theme.navInactive
                }`}
              >
                <ShoppingBag className="w-3.5 h-3.5" /> Joint Register
              </button>

              {/* Staff Trade-Ins & Upcoming Payouts (Only visible when logged in with 9999 / Master Control) */}
              {userRole === 'admin' && (
                <>
                  <button
                    id="nav-tab-staff-tradeins"
                    onClick={() => setActiveTab('staffTradeIns')}
                    className={`px-3 py-2 rounded-md transition-all flex items-center gap-1.5 ${
                      activeTab === 'staffTradeIns' 
                        ? theme.navActive 
                        : theme.navInactive
                    }`}
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                    Real-Time Trade-Ins
                  </button>

                  <button
                    id="nav-tab-staff-payouts"
                    onClick={() => setActiveTab('staffPayouts')}
                    className={`px-3 py-2 rounded-md transition-all flex items-center gap-1.5 ${
                      activeTab === 'staffPayouts' 
                        ? theme.navActive 
                        : theme.navInactive
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    Upcoming Payouts
                  </button>

                  <button
                    id="nav-tab-raffle"
                    onClick={() => setActiveTab('raffle')}
                    className={`px-3 py-2 rounded-md transition-all flex items-center gap-1.5 ${
                      activeTab === 'raffle' 
                        ? theme.navActive 
                        : theme.navInactive
                    }`}
                  >
                    <Ticket className="w-3.5 h-3.5 text-amber-400" />
                    Raffle Draw
                  </button>
                </>
              )}

              {/* Newton Master Control */}
              {userRole === 'admin' && (
                <button
                  id="nav-tab-admin"
                  onClick={() => setActiveTab('admin')}
                  className={`px-3 py-2 rounded-md transition-all flex items-center gap-1.5 ${
                    activeTab === 'admin' 
                      ? theme.navActive 
                      : theme.navInactive
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-300" /> Stall Control
                </button>
              )}

              {/* Guest Login Tab */}
              {!currentUser && (
                <button
                  id="nav-tab-login"
                  onClick={() => setActiveTab('login')}
                  className={`px-3 py-2 rounded-md transition-all flex items-center gap-1.5 ${
                    activeTab === 'login' 
                      ? theme.navActive 
                      : theme.navInactive
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" /> Vendor Login
                </button>
              )}
            </nav>

            {/* Logout and session details / Login Button */}
            <div className="flex items-center gap-2">
              {currentUser ? (
                <div className="hidden md:flex items-center gap-3">
                  <div className="text-right">
                    <span className={`text-xs font-bold block leading-tight ${theme.nameText}`}>
                      {currentUser.name.split(' ')[0]}
                    </span>
                    <span className={`text-[10px] font-bold uppercase tracking-widest block mt-0.5 ${theme.roleText}`}>
                      {userRole === 'admin' ? 'Stall Master' : 'Vendor'}
                    </span>
                  </div>
                  <button
                    id="btn-logout-desktop"
                    onClick={handleLogout}
                    className={theme.logoutBtn}
                    title="Log Out Securely"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="hidden md:flex items-center">
                  <button
                    id="btn-login-desktop"
                    onClick={() => setActiveTab('login')}
                    className={`px-4 py-2 text-xs font-bold rounded-lg border transition-all flex items-center gap-2 cursor-pointer ${
                      activeTab === 'login'
                        ? 'bg-zinc-900 text-white border-zinc-900 shadow-xs'
                        : 'bg-white text-zinc-700 border-zinc-200 hover:border-zinc-300'
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4" /> Log In
                  </button>
                </div>
              )}

              {/* Mobile Menu Hamburger button */}
              <button
                id="btn-toggle-mobile-menu"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className={theme.mobileToggle}
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu collapsible */}
        {mobileMenuOpen && (
          <div className={`md:hidden border-t px-4 py-3 space-y-2 shadow-inner ${theme.mobileMenuBg}`}>
            {currentUser ? (
              <div className="pb-2 mb-2 border-b border-zinc-200/50 flex justify-between items-center text-xs">
                <div>
                  <p className="font-bold">{currentUser.name}</p>
                  <p className="text-[10px] opacity-70 font-semibold uppercase tracking-wider">{userRole === 'admin' ? 'Newton Control' : 'Pokemon Vendor'}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="text-[10px] text-red-600 font-bold flex items-center gap-1 bg-red-50 py-1.5 px-3 rounded-lg border border-red-100/50"
                >
                  <LogOut className="w-3 h-3" /> Log Out
                </button>
              </div>
            ) : (
              <div className="pb-2 mb-2 border-b border-zinc-200/50 flex justify-between items-center text-xs">
                <div>
                  <p className="font-bold">Guest User</p>
                  <p className="text-[10px] opacity-70 font-semibold uppercase tracking-wider">Joint Register Mode</p>
                </div>
                <button
                  onClick={() => { setActiveTab('login'); setMobileMenuOpen(false); }}
                  className="text-[10px] text-blue-600 font-bold flex items-center gap-1.5 bg-blue-50 py-1.5 px-3 rounded-lg border border-blue-100/50"
                >
                  <ShieldCheck className="w-3.5 h-3.5" /> Log In
                </button>
              </div>
            )}

            {(userRole === 'vendor' || (userRole === 'admin' && adminViewingVendorId)) && (
              <>
                <button
                  id="mob-tab-home"
                  onClick={() => { setActiveTab('home'); setMobileMenuOpen(false); }}
                  className={`w-full py-2 px-3 rounded-md text-xs font-semibold text-left block ${
                    activeTab === 'home' ? theme.mobileNavActive : theme.mobileNavInactive
                  }`}
                >
                  Dashboard Home
                </button>
                <button
                  id="mob-tab-stock"
                  onClick={() => { setActiveTab('stock'); setMobileMenuOpen(false); }}
                  className={`w-full py-2 px-3 rounded-md text-xs font-semibold text-left block ${
                    activeTab === 'stock' ? theme.mobileNavActive : theme.mobileNavInactive
                  }`}
                >
                  Stock Catalog
                </button>
                <button
                  id="mob-tab-payouts"
                  onClick={() => { setActiveTab('payouts'); setMobileMenuOpen(false); }}
                  className={`w-full py-2 px-3 rounded-md text-xs font-semibold text-left block ${
                    activeTab === 'payouts' ? theme.mobileNavActive : theme.mobileNavInactive
                  }`}
                >
                  Payout & Trade-In
                </button>
              </>
            )}

            <button
              id="mob-tab-staff"
              onClick={() => { setActiveTab('staff'); setMobileMenuOpen(false); }}
              className={`w-full py-2 px-3 rounded-md text-xs font-semibold text-left block ${
                activeTab === 'staff' ? theme.mobileNavActive : theme.mobileNavInactive
              }`}
            >
              Joint Staff Register
            </button>

            {userRole === 'admin' && (
              <>
                <button
                  id="mob-tab-staff-tradeins"
                  onClick={() => { setActiveTab('staffTradeIns'); setMobileMenuOpen(false); }}
                  className={`w-full py-2 px-3 rounded-md text-xs font-semibold text-left flex items-center justify-between ${
                    activeTab === 'staffTradeIns' ? theme.mobileNavActive : theme.mobileNavInactive
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                    Real-Time Trade-Ins Log
                  </span>
                </button>

                <button
                  id="mob-tab-staff-payouts"
                  onClick={() => { setActiveTab('staffPayouts'); setMobileMenuOpen(false); }}
                  className={`w-full py-2 px-3 rounded-md text-xs font-semibold text-left flex items-center justify-between ${
                    activeTab === 'staffPayouts' ? theme.mobileNavActive : theme.mobileNavInactive
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5" />
                    Upcoming Payouts Totals
                  </span>
                </button>

                <button
                  id="mob-tab-raffle"
                  onClick={() => { setActiveTab('raffle'); setMobileMenuOpen(false); }}
                  className={`w-full py-2 px-3 rounded-md text-xs font-semibold text-left flex items-center justify-between ${
                    activeTab === 'raffle' ? theme.mobileNavActive : theme.mobileNavInactive
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Ticket className="w-3.5 h-3.5 text-amber-400" />
                    Raffle Draw
                  </span>
                </button>
              </>
            )}

            {userRole === 'admin' && (
              <button
                id="mob-tab-admin"
                onClick={() => { setActiveTab('admin'); setMobileMenuOpen(false); }}
                className={`w-full py-2.5 px-4 rounded-md text-xs font-bold text-left block ${
                  activeTab === 'admin' ? theme.mobileNavActive : theme.mobileNavInactive
                }`}
              >
                Stall Control
              </button>
            )}

            {!currentUser && (
              <button
                id="mob-tab-login"
                onClick={() => { setActiveTab('login'); setMobileMenuOpen(false); }}
                className={`w-full py-2 px-3 rounded-md text-xs font-semibold text-left block ${
                  activeTab === 'login' ? theme.mobileNavActive : theme.mobileNavInactive
                }`}
              >
                Log In (Vendor / Stall Control)
              </button>
            )}
          </div>
        )}
      </header>

      {/* Main Workspace Frame */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Stall Control Active Preview Banner */}
        {userRole === 'admin' && adminViewingVendorId && activeVendorObject && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs animate-in slide-in-from-top-1 duration-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 text-blue-700 rounded-lg flex items-center justify-center font-extrabold shrink-0 text-lg">
                👁️
              </div>
              <div>
                <h4 className="text-xs font-black text-blue-900 uppercase tracking-wide">Stall Control Active Preview</h4>
                <p className="text-[11px] text-blue-700 font-semibold mt-0.5">
                  Currently viewing profile/dashboard of <strong className="font-extrabold text-blue-900">{activeVendorObject.name}</strong> without PIN authorization.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                id="btn-switch-to-register"
                onClick={() => setActiveTab('staff')}
                className="px-3 py-2 bg-white hover:bg-zinc-50 text-zinc-700 border border-zinc-200 text-xs font-bold rounded-lg transition-colors cursor-pointer"
              >
                Joint Register
              </button>
              <button
                id="btn-exit-vendor-preview"
                onClick={() => {
                  setAdminViewingVendorId(null);
                  setActiveTab('admin');
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-extrabold rounded-lg shadow-sm transition-colors cursor-pointer whitespace-nowrap"
              >
                ← Back to Stall Control
              </button>
            </div>
          </div>
        )}

        {/* Tab Router Switch */}
        {(userRole === 'vendor' || (userRole === 'admin' && adminViewingVendorId)) && activeTab === 'home' && activeVendorObject && (
          <DashboardHome
            vendor={activeVendorObject}
            sales={sales}
            cashouts={cashouts}
            tradeIns={tradeIns}
            onNavigate={(tab) => setActiveTab(tab)}
          />
        )}

        {(activeTab === 'staff' || activeTab === 'staffPayouts' || activeTab === 'staffTradeIns') && (
          <JointStaffPage
            vendors={vendors}
            stock={stock}
            sales={sales}
            cashouts={cashouts}
            tradeIns={tradeIns}
            onLogSale={handleLogSale}
            onAddTradeIn={handleAddTradeIn}
            userRole={userRole}
            adminViewingVendorId={adminViewingVendorId}
            onViewVendorProfile={(vendorId) => {
              setAdminViewingVendorId(vendorId);
              setActiveTab('home');
            }}
            onUpdateSale={handleUpdateSale}
            onDeleteSale={handleDeleteSale}
            currentUser={currentUser}
            initialSubTab={activeTab === 'staffTradeIns' ? 'tradeIns' : activeTab === 'staffPayouts' ? 'upcomingPayouts' : 'register'}
            onLogin={handleLoginSubmit}
            loginError={pinError}
            loginLoading={authLoading}
          />
        )}

        {(userRole === 'vendor' || (userRole === 'admin' && adminViewingVendorId)) && activeTab === 'stock' && activeVendorObject && (
          <StockManager
            vendor={activeVendorObject}
            stock={stock}
            onAddStock={handleAddStock}
            vendors={vendors}
          />
        )}

        {(userRole === 'vendor' || (userRole === 'admin' && adminViewingVendorId)) && activeTab === 'payouts' && activeVendorObject && (
          <CashoutAndTradeIn
            vendor={activeVendorObject}
            sales={sales}
            cashouts={cashouts}
            tradeIns={tradeIns}
            onRequestCashout={handleRequestCashout}
            onAddTradeIn={handleAddTradeIn}
          />
        )}

        {userRole === 'admin' && activeTab === 'admin' && (
          <MasterControl
            vendors={vendors}
            sales={sales}
            cashouts={cashouts}
            tradeIns={tradeIns}
            onUpdateVendor={handleUpdateVendor}
            onRespondCashout={handleRespondCashout}
            onUpdateCashoutAmount={handleUpdateCashoutAmount}
            onRespondTradeIn={handleRespondTradeIn}
            onUpdateSale={handleUpdateSale}
            onDeleteSale={handleDeleteSale}
            onViewVendorProfile={(vendorId) => {
              setAdminViewingVendorId(vendorId);
              setActiveTab('home');
            }}
          />
        )}

        {userRole === 'admin' && activeTab === 'raffle' && (
          <RaffleDrawTab
            entries={raffleEntries}
            history={raffleHistory}
            onAddEntry={handleAddRaffleEntry}
            onDeleteEntry={handleDeleteRaffleEntry}
            onUpdateEntry={handleUpdateRaffleEntry}
            onClearEntries={handleClearRaffleEntries}
            onSaveDrawResult={handleSaveRaffleResult}
            onDeleteHistoryItem={handleDeleteRaffleHistory}
          />
        )}

        {activeTab === 'login' && !currentUser && (
          <div className="bg-white py-8 px-4 rounded-xl shadow-xs border border-zinc-200/60 max-w-md mx-auto my-8">
            <PINLogin
              onLogin={handleLoginSubmit}
              error={pinError}
              loading={authLoading}
            />
          </div>
        )}

      </main>

      {/* Styled simple footer */}
      <footer className="bg-white border-t border-zinc-200 py-6 text-center text-[10px] text-zinc-400 font-bold uppercase tracking-widest">
        Newton's Collectables • Saturday & Wednesday • Bury St Edmunds Pokémon Market Stall
      </footer>
    </div>
  );
}
