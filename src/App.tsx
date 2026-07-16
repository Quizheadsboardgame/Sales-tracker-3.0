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
  X
} from 'lucide-react';
import { Vendor, StockItem, Sale, TradeProposal, CashoutRequest, TradeIn } from './types';
import PINLogin from './components/PINLogin';
import DashboardHome from './components/DashboardHome';
import JointStaffPage from './components/JointStaffPage';
import StockManager from './components/StockManager';
import CashoutAndTradeIn from './components/CashoutAndTradeIn';
import MasterControl from './components/MasterControl';

export default function App() {
  // Database States
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [trades, setTrades] = useState<TradeProposal[]>([]);
  const [cashouts, setCashouts] = useState<CashoutRequest[]>([]);
  const [tradeIns, setTradeIns] = useState<TradeIn[]>([]);

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

  // Load Entire State from backend
  const refreshAppState = async () => {
    setIsSyncing(true);
    setSyncError(null);
    try {
      const res = await fetch('/api/state');
      if (res.ok) {
        const data = await res.json();
        setVendors(data.vendors || []);
        setStock(data.stock || []);
        setSales(data.sales || []);
        setTrades(data.trades || []);
        setCashouts(data.cashouts || []);
        setTradeIns(data.tradeIns || []);
        setLastSynced(new Date());
      } else {
        setSyncError("Failed to fetch state from network");
      }
    } catch (err: any) {
      console.error("Error synchronizing with state database", err);
      setSyncError(err.message || "Network Sync failed");
    } finally {
      setIsSyncing(false);
      setIsLoadingState(false);
    }
  };

  useEffect(() => {
    // 1. Initial State Fetch
    refreshAppState();
    
    // Restore login session from localStorage if available
    const savedUser = localStorage.getItem('newtons_session_user');
    const savedRole = localStorage.getItem('newtons_session_role');
    if (savedUser && savedRole) {
      setCurrentUser(JSON.parse(savedUser));
      setUserRole(savedRole as 'vendor' | 'admin');
      setActiveTab(savedRole === 'admin' ? 'admin' : 'home');
    }

    let eventSource: EventSource | null = null;

    // Helper to connect to real-time updates via Server-Sent Events (SSE)
    const connectSSE = () => {
      if (eventSource) {
        eventSource.close();
      }

      try {
        eventSource = new EventSource('/api/updates');

        eventSource.onmessage = (event) => {
          if (event.data === 'connected') return;
          try {
            const payload = JSON.parse(event.data);
            if (payload.type === 'update') {
              refreshAppState();
            }
          } catch (err) {
            console.error("Error parsing SSE real-time payload:", err);
          }
        };

        eventSource.onerror = (err) => {
          console.warn("Real-time SSE connection disconnected, auto-retrying...", err);
        };
      } catch (err) {
        console.error("Failed to establish real-time SSE connection:", err);
      }
    };

    // Only start the SSE connection once the document is visible
    if (document.visibilityState === 'visible') {
      connectSSE();
    }

    // Connect/disconnect based on tab visibility
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Re-sync immediately on return to app
        refreshAppState();
        connectSSE();
      } else {
        // Disconnect immediately when backgrounded to free up HTTP/1.1 ports (crucial for mobile Safari/Chrome concurrency)
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (eventSource) {
        eventSource.close();
      }
    };
  }, []);

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
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      });

      const data = await res.json();
      if (res.ok) {
        // Sync our react vendor state in case admin updated commissions
        await refreshAppState();
        
        if (data.role === 'admin') {
          handleLoginSuccess(data.user, 'admin');
        } else {
          handleLoginSuccess(data.user, 'vendor');
        }
      } else {
        setPinError(data.error || "Login authorization failed.");
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
    }>;
    tradeIn?: {
      details: string;
      amount: number;
    };
  }) => {
    const res = await fetch('/api/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(saleData)
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to log register sale.");
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
    const res = await fetch('/api/stock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(stockData)
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to update stock catalog.");
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
    const res = await fetch('/api/trades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tradeData)
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to transmit swap proposal.");
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
    const res = await fetch(`/api/trades/${tradeId}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, ...responseDetails })
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to transmit trade response.");
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
    const res = await fetch('/api/cashouts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vendorId, amount })
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to submit cash out hold release.");
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
    const res = await fetch('/api/trade-ins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tradeInData)
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to transmit trade-in details.");
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
    const res = await fetch('/api/admin/vendors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(vendorData)
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to update vendor structures.");
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
    const res = await fetch(`/api/admin/sales/${saleId}/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(saleData)
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to update sale.");
    }

    await refreshAppState();
  };

  // Admin: Delete sale
  const handleDeleteSale = async (saleId: string) => {
    const res = await fetch(`/api/admin/sales/${saleId}/delete`, {
      method: 'POST'
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to delete sale.");
    }

    await refreshAppState();
  };

  // Admin: Approve cashout
  const handleRespondCashout = async (cashoutId: string, status: 'approved' | 'declined') => {
    const res = await fetch(`/api/admin/cashouts/${cashoutId}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to register payout response.");
    }

    await refreshAppState();
  };

  // Admin: Approve trade-in
  const handleRespondTradeIn = async (tradeInId: string, status: 'approved' | 'declined', finalCredit?: number) => {
    const res = await fetch(`/api/admin/trade-ins/${tradeInId}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, finalCredit })
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to register trade-in response.");
    }

    await refreshAppState();
  };

  // Main UI render logic
  if (isLoadingState) {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-zinc-500 font-medium">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs tracking-wider uppercase font-bold text-zinc-400">Syncing Newton's Ledger...</span>
        </div>
      </div>
    );
  }

  // Active user details
  const activeVendorObject = adminViewingVendorId 
    ? vendors.find((v) => v.id === adminViewingVendorId)
    : (currentUser ? vendors.find((v) => v.id === currentUser.id) : null);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 flex flex-col font-sans">
      {/* Premium Header Branding in Geometric Balance theme */}
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-xs">
                N
              </div>
              <div>
                <h1 className="font-bold text-sm leading-tight text-zinc-900 tracking-wide uppercase">Newtons</h1>
                <p className="text-[10px] text-zinc-400 tracking-widest uppercase font-medium">Collectables</p>
              </div>
              <div className="hidden sm:flex items-center gap-1.5 ml-4 px-2.5 py-1 bg-zinc-100 border border-zinc-200 rounded text-[10px] text-zinc-500 font-bold tracking-wide">
                <MapPin className="w-3 h-3 text-zinc-400" /> Bury St Edmunds • <Calendar className="w-3 h-3 text-zinc-400" /> Wed & Sat
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
                        ? 'bg-zinc-100 text-blue-600 font-bold' 
                        : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900'
                    }`}
                  >
                    Dashboard
                  </button>
                  <button
                    id="nav-tab-stock"
                    onClick={() => setActiveTab('stock')}
                    className={`px-3 py-2 rounded-md transition-all ${
                      activeTab === 'stock' 
                        ? 'bg-zinc-100 text-blue-600 font-bold' 
                        : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900'
                    }`}
                  >
                    Stock Catalog
                  </button>
                  <button
                    id="nav-tab-payouts"
                    onClick={() => setActiveTab('payouts')}
                    className={`px-3 py-2 rounded-md transition-all ${
                      activeTab === 'payouts' 
                        ? 'bg-zinc-100 text-blue-600 font-bold' 
                        : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900'
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
                    ? 'bg-blue-50 text-blue-600 font-bold border border-blue-100/60' 
                    : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900'
                }`}
              >
                <ShoppingBag className="w-3.5 h-3.5" /> Joint Register
              </button>

              {/* Newton Master Control */}
              {userRole === 'admin' && (
                <button
                  id="nav-tab-admin"
                  onClick={() => setActiveTab('admin')}
                  className={`px-3 py-2 rounded-md transition-all flex items-center gap-1.5 ${
                    activeTab === 'admin' 
                      ? 'bg-zinc-900 text-white font-bold' 
                      : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-500" /> Stall Control
                </button>
              )}

              {/* Guest Login Tab */}
              {!currentUser && (
                <button
                  id="nav-tab-login"
                  onClick={() => setActiveTab('login')}
                  className={`px-3 py-2 rounded-md transition-all flex items-center gap-1.5 ${
                    activeTab === 'login' 
                      ? 'bg-blue-50 text-blue-600 font-bold border border-blue-100/60' 
                      : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" /> Vendor Login
                </button>
              )}
            </nav>

            {/* Logout and session details / Login Button */}
            <div className="flex items-center gap-2">
              {/* Header Sync Status & Button - Desktop only */}
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-zinc-50 border border-zinc-200/60 rounded-xl text-[10px] text-zinc-500 font-bold mr-2 select-none">
                <span className={`w-1.5 h-1.5 rounded-full ${isSyncing ? 'bg-blue-500 animate-pulse' : syncError ? 'bg-red-500' : 'bg-green-500'}`} />
                <span className="uppercase tracking-wider">
                  {isSyncing ? 'Syncing...' : syncError ? 'Sync Error' : 'Cloud Connected'}
                </span>
                <span className="text-zinc-300">|</span>
                <span className="text-[9px] text-zinc-400">
                  {lastSynced ? lastSynced.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Never'}
                </span>
                <button 
                  id="btn-header-sync"
                  onClick={refreshAppState} 
                  disabled={isSyncing} 
                  className="hover:text-zinc-900 text-zinc-400 hover:bg-zinc-200/50 p-1 rounded-md transition-all cursor-pointer flex items-center justify-center disabled:opacity-50"
                  title="Force Sync All Devices"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-blue-600' : ''}`} />
                </button>
              </div>

              {currentUser ? (
                <div className="hidden md:flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-xs font-bold text-zinc-900 block leading-tight">
                      {currentUser.name.split(' ')[0]}
                    </span>
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mt-0.5">
                      {userRole === 'admin' ? 'Stall Master' : 'Vendor'}
                    </span>
                  </div>
                  <button
                    id="btn-logout-desktop"
                    onClick={handleLogout}
                    className="p-2 bg-zinc-50 hover:bg-red-50 hover:text-red-600 text-zinc-400 rounded-lg transition-colors focus:outline-none border border-zinc-200/40 cursor-pointer"
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
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-white text-zinc-700 border-zinc-200 hover:border-zinc-300'
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4" /> Log In
                  </button>
                </div>
              )}

              {/* Mobile Sync Icon Button (Always visible on mobile phone headers next to hamburger!) */}
              <button
                id="btn-sync-mobile"
                onClick={refreshAppState}
                disabled={isSyncing}
                className="md:hidden p-2 text-zinc-600 bg-zinc-50 hover:bg-zinc-100 disabled:opacity-50 rounded-lg transition-colors focus:outline-none border border-zinc-200/50 flex items-center justify-center cursor-pointer text-zinc-500"
                title={`Last Synced: ${lastSynced ? lastSynced.toLocaleTimeString() : 'Never'}`}
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-blue-600' : ''}`} />
              </button>

              {/* Mobile Menu Hamburger button */}
              <button
                id="btn-toggle-mobile-menu"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 text-zinc-600 bg-zinc-50 hover:bg-zinc-100 rounded-lg transition-colors focus:outline-none border border-zinc-200/50"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu collapsible */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-zinc-200 bg-white px-4 py-3 space-y-2 shadow-inner">
            {currentUser ? (
              <div className="pb-2 mb-2 border-b border-zinc-100 flex justify-between items-center text-xs">
                <div>
                  <p className="font-bold text-zinc-900">{currentUser.name}</p>
                  <p className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">{userRole === 'admin' ? 'Newton Control' : 'Pokemon Vendor'}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="text-[10px] text-red-600 font-bold flex items-center gap-1 bg-red-50 py-1.5 px-3 rounded-lg border border-red-100/50"
                >
                  <LogOut className="w-3 h-3" /> Log Out
                </button>
              </div>
            ) : (
              <div className="pb-2 mb-2 border-b border-zinc-100 flex justify-between items-center text-xs">
                <div>
                  <p className="font-bold text-zinc-900">Guest User</p>
                  <p className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">Joint Register Mode</p>
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
                    activeTab === 'home' ? 'bg-zinc-100 text-blue-600 font-bold' : 'text-zinc-500 hover:bg-zinc-50'
                  }`}
                >
                  Dashboard Home
                </button>
                <button
                  id="mob-tab-stock"
                  onClick={() => { setActiveTab('stock'); setMobileMenuOpen(false); }}
                  className={`w-full py-2 px-3 rounded-md text-xs font-semibold text-left block ${
                    activeTab === 'stock' ? 'bg-zinc-100 text-blue-600 font-bold' : 'text-zinc-500 hover:bg-zinc-50'
                  }`}
                >
                  Stock Catalog
                </button>
                <button
                  id="mob-tab-payouts"
                  onClick={() => { setActiveTab('payouts'); setMobileMenuOpen(false); }}
                  className={`w-full py-2 px-3 rounded-md text-xs font-semibold text-left block ${
                    activeTab === 'payouts' ? 'bg-zinc-100 text-blue-600 font-bold' : 'text-zinc-500 hover:bg-zinc-50'
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
                activeTab === 'staff' ? 'bg-blue-50 text-blue-600 font-bold' : 'text-zinc-500 hover:bg-zinc-50'
              }`}
            >
              Joint Staff Register
            </button>

            {userRole === 'admin' && (
              <button
                id="mob-tab-admin"
                onClick={() => { setActiveTab('admin'); setMobileMenuOpen(false); }}
                className={`w-full py-2.5 px-4 rounded-md text-xs font-bold text-left block ${
                  activeTab === 'admin' ? 'bg-zinc-900 text-white' : 'text-zinc-500'
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
                  activeTab === 'login' ? 'bg-zinc-100 text-blue-600 font-bold' : 'text-zinc-500 hover:bg-zinc-50'
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
        
        {/* Enhanced Sync Information & Share Center */}
        <div className="mb-6 bg-white border border-zinc-200 rounded-xl p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-300">
          <div className="flex items-start sm:items-center gap-3">
            <div className={`p-2 rounded-lg shrink-0 ${isSyncing ? 'bg-blue-50 text-blue-600' : syncError ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
              <RefreshCw className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-xs font-black text-zinc-800 uppercase tracking-wide">Multi-Device Cloud Sync</h4>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                  isSyncing 
                    ? 'bg-blue-50 text-blue-600 border border-blue-100 animate-pulse' 
                    : syncError 
                      ? 'bg-red-50 text-red-600 border border-red-100' 
                      : 'bg-green-50 text-green-600 border border-green-100'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isSyncing ? 'bg-blue-500' : syncError ? 'bg-red-500' : 'bg-green-500'}`} />
                  {isSyncing ? 'Syncing...' : syncError ? 'Sync Error' : 'Live Connected'}
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">
                {syncError ? (
                  <span className="text-red-600 font-semibold">Error: {syncError}. Tap force sync to reconnect.</span>
                ) : (
                  <>
                    All logged sales, trade-ins, and stock are shared across devices instantly via Google Firestore Cloud.
                    <span className="font-extrabold text-zinc-700 ml-1.5 bg-zinc-100 px-2 py-0.5 rounded-md inline-block sm:inline">
                      Last Synced: {lastSynced ? lastSynced.toLocaleTimeString() : 'Never'}
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              id="btn-sync-state-enhanced"
              onClick={refreshAppState}
              disabled={isSyncing}
              className={`px-4 py-2 text-xs font-extrabold rounded-lg border cursor-pointer transition-all flex items-center justify-center gap-1.5 w-full sm:w-auto uppercase tracking-wide ${
                isSyncing
                  ? 'bg-zinc-50 text-zinc-400 border-zinc-200'
                  : 'bg-zinc-950 text-white border-zinc-950 hover:bg-zinc-800 active:scale-95 shadow-xs'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : 'Force Cloud Sync'}
            </button>
          </div>
        </div>

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

        {activeTab === 'staff' && (
          <JointStaffPage
            vendors={vendors}
            stock={stock}
            sales={sales}
            cashouts={cashouts}
            tradeIns={tradeIns}
            onLogSale={handleLogSale}
            userRole={userRole}
            adminViewingVendorId={adminViewingVendorId}
            onViewVendorProfile={(vendorId) => {
              setAdminViewingVendorId(vendorId);
              setActiveTab('home');
            }}
            onUpdateSale={handleUpdateSale}
            onDeleteSale={handleDeleteSale}
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
            onRespondTradeIn={handleRespondTradeIn}
            onUpdateSale={handleUpdateSale}
            onDeleteSale={handleDeleteSale}
            onViewVendorProfile={(vendorId) => {
              setAdminViewingVendorId(vendorId);
              setActiveTab('home');
            }}
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
