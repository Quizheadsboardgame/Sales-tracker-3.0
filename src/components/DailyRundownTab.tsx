import React, { useState, useEffect, useMemo } from 'react';
import { 
  DollarSign, 
  Coins, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  ArrowRight, 
  ArrowDownRight, 
  ArrowUpRight, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  Check, 
  Printer, 
  RefreshCw, 
  ShieldCheck, 
  Search, 
  Wallet, 
  Receipt, 
  Percent, 
  Clock, 
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Sparkles,
  HelpCircle
} from 'lucide-react';
import { Vendor, Sale, TradeIn, CashoutRequest } from '../types';

interface DailyRundownTabProps {
  vendors: Vendor[];
  sales: Sale[];
  tradeIns: TradeIn[];
  cashouts?: CashoutRequest[];
  onViewVendorProfile?: (vendorId: string) => void;
}

export function DailyRundownTab({
  vendors,
  sales,
  tradeIns,
  cashouts = [],
  onViewVendorProfile
}: DailyRundownTabProps) {
  // Helper to format local date key (YYYY-MM-DD)
  const getLocalDateKey = (d: Date = new Date()) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getYesterdayDateKey = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return getLocalDateKey(d);
  };

  const [selectedDate, setSelectedDate] = useState<string>(() => getLocalDateKey());
  const [copiedReport, setCopiedReport] = useState(false);
  const [filterVendorId, setFilterVendorId] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [showFormulaExplainer, setShowFormulaExplainer] = useState(false);
  const [countedCashInput, setCountedCashInput] = useState<string>('');

  // Starting float state with localStorage persistence per date
  const [startingFloatInput, setStartingFloatInput] = useState<string>(() => {
    try {
      const todayKey = getLocalDateKey();
      const saved = localStorage.getItem(`stall_starting_float_${todayKey}`);
      return saved !== null ? saved : '100.00';
    } catch {
      return '100.00';
    }
  });

  // When selectedDate changes, load stored float for that date if exists
  useEffect(() => {
    try {
      const savedFloat = localStorage.getItem(`stall_starting_float_${selectedDate}`);
      if (savedFloat !== null) {
        setStartingFloatInput(savedFloat);
      }
      const savedCounted = localStorage.getItem(`stall_counted_cash_${selectedDate}`);
      if (savedCounted !== null) {
        setCountedCashInput(savedCounted);
      } else {
        setCountedCashInput('');
      }
    } catch (e) {
      console.warn("Could not access localStorage for float:", e);
    }
  }, [selectedDate]);

  const handleFloatChange = (val: string) => {
    setStartingFloatInput(val);
    try {
      localStorage.setItem(`stall_starting_float_${selectedDate}`, val);
    } catch (e) {}
  };

  const handleCountedCashChange = (val: string) => {
    setCountedCashInput(val);
    try {
      if (val.trim()) {
        localStorage.setItem(`stall_counted_cash_${selectedDate}`, val);
      } else {
        localStorage.removeItem(`stall_counted_cash_${selectedDate}`);
      }
    } catch (e) {}
  };

  const setFloatPreset = (amount: number) => {
    const str = amount.toFixed(2);
    setStartingFloatInput(str);
    try {
      localStorage.setItem(`stall_starting_float_${selectedDate}`, str);
    } catch (e) {}
  };

  const getVendorColorEmoji = (color?: string): string => {
    if (!color) return '⚪';
    const hex = color.toUpperCase();
    if (hex === '#10B981' || hex.includes('GREEN') || hex === '#22C55E') return '🟢';
    if (hex === '#F59E0B' || hex.includes('ORANGE') || hex === '#F97316') return '🟠';
    if (hex === '#FFFFFF' || hex.includes('WHITE')) return '⚪';
    if (hex === '#EC4899' || hex === '#F43F5E' || hex.includes('PINK') || hex.includes('ROSE')) return '🌸';
    if (hex === '#FACC15' || hex === '#EAB308' || hex.includes('YELLOW')) return '🟡';
    if (hex === '#64748B' || hex === '#71717A' || hex === '#737373' || hex.includes('SLATE') || hex.includes('GRAY') || hex.includes('GREY')) return '⚫';
    if (hex === '#3B82F6' || hex === '#06B6D4' || hex === '#0EA5E9' || hex.includes('BLUE') || hex.includes('TEAL') || hex.includes('CYAN')) return '🔵';
    if (hex === '#EF4444' || hex.includes('RED')) return '🔴';
    if (hex === '#8B5CF6' || hex === '#A855F7' || hex.includes('PURPLE')) return '🟣';
    return '⚫';
  };

  // Filter today's sales and trade-ins
  const targetDateObj = useMemo(() => {
    const parts = selectedDate.split('-');
    if (parts.length === 3) {
      return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    }
    return new Date(selectedDate);
  }, [selectedDate]);

  const formattedDateHeadline = useMemo(() => {
    return targetDateObj.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }, [targetDateObj]);

  const isToday = selectedDate === getLocalDateKey();
  const isYesterday = selectedDate === getYesterdayDateKey();

  // Filter Sales for selected date
  const daySales = useMemo(() => {
    return sales.filter((sale) => {
      const sDate = new Date(sale.date);
      return (
        sDate.getFullYear() === targetDateObj.getFullYear() &&
        sDate.getMonth() === targetDateObj.getMonth() &&
        sDate.getDate() === targetDateObj.getDate()
      );
    });
  }, [sales, targetDateObj]);

  // Filter Trade-Ins for selected date
  const dayTradeIns = useMemo(() => {
    return tradeIns.filter((trade) => {
      const tDate = new Date(trade.date);
      return (
        tDate.getFullYear() === targetDateObj.getFullYear() &&
        tDate.getMonth() === targetDateObj.getMonth() &&
        tDate.getDate() === targetDateObj.getDate()
      );
    });
  }, [tradeIns, targetDateObj]);

  // Helper to reliably extract the absolute trade-in value (regardless of sign or field format)
  const getTradeInAbsoluteValue = (trade: TradeIn): number => {
    const est = Math.abs(Number(trade.estimatedValue) || 0);
    const credit = Math.abs(Number(trade.creditApplied) || 0);
    return est > 0 ? est : credit;
  };

  // Numeric Calculations
  const startingFloat = Number(startingFloatInput) || 0;
  const totalSalesGross = useMemo(() => daySales.reduce((sum, s) => sum + (Number(s.price) || 0), 0), [daySales]);
  const totalSalesCount = daySales.length;
  const totalCommissionEarned = useMemo(() => daySales.reduce((sum, s) => sum + (Number(s.commissionAmount) || 0), 0), [daySales]);
  const totalVendorEarnings = useMemo(() => daySales.reduce((sum, s) => sum + (Number(s.vendorEarnings) || 0), 0), [daySales]);

  const totalTradeInsValue = useMemo(() => dayTradeIns.reduce((sum, t) => sum + getTradeInAbsoluteValue(t), 0), [dayTradeIns]);
  const totalTradeInsCount = dayTradeIns.length;

  // The Total = Starting Float + Gross Sales - Trade-Ins (as trade-ins do not add to cash value)
  // Example: Float £100 + Sales £500 - Trade-In £200 = Total £400
  const totalBalance = startingFloat + totalSalesGross - totalTradeInsValue;
  const netDailySales = totalSalesGross - totalTradeInsValue;

  const countedCash = countedCashInput.trim() !== '' ? Number(countedCashInput) : null;
  const drawerVariance = countedCash !== null ? (countedCash - totalBalance) : null;

  // Vendor Breakdown for Selected Date
  const vendorBreakdown = useMemo(() => {
    return vendors.map((v) => {
      const vSales = daySales.filter(s => s.vendorId === v.id);
      const vGross = vSales.reduce((sum, s) => sum + (Number(s.price) || 0), 0);
      const vComm = vSales.reduce((sum, s) => sum + (Number(s.commissionAmount) || 0), 0);
      const vEarned = vSales.reduce((sum, s) => sum + (Number(s.vendorEarnings) || 0), 0);

      const vTrades = dayTradeIns.filter(t => t.vendorId === v.id);
      const vTradeValue = vTrades.reduce((sum, t) => sum + getTradeInAbsoluteValue(t), 0);
      const vNet = vGross - vTradeValue;

      return {
        vendor: v,
        salesCount: vSales.length,
        grossSales: vGross,
        commission: vComm,
        vendorEarnings: vEarned,
        tradeInsCount: vTrades.length,
        tradeInsValue: vTradeValue,
        netBalance: vNet,
        hasActivity: vSales.length > 0 || vTrades.length > 0
      };
    }).sort((a, b) => b.grossSales - a.grossSales);
  }, [vendors, daySales, dayTradeIns]);

  // Combined Chronological Transaction Feed
  interface ChronoTransaction {
    id: string;
    type: 'sale' | 'tradein';
    date: string;
    vendorId: string;
    vendorName: string;
    title: string;
    amount: number; // positive for sale, negative for tradein
    rawItem: Sale | TradeIn;
  }

  const combinedChronology = useMemo(() => {
    const list: ChronoTransaction[] = [];

    daySales.forEach(s => {
      list.push({
        id: s.id,
        type: 'sale',
        date: s.date,
        vendorId: s.vendorId,
        vendorName: s.vendorName,
        title: s.itemName,
        amount: Number(s.price) || 0,
        rawItem: s
      });
    });

    dayTradeIns.forEach(t => {
      const val = getTradeInAbsoluteValue(t);
      list.push({
        id: t.id,
        type: 'tradein',
        date: t.date,
        vendorId: t.vendorId,
        vendorName: t.vendorName,
        title: t.details || 'Trade-in Cards/Items',
        amount: -val,
        rawItem: t
      });
    });

    // Sort chronologically ascending to calculate running total
    list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let runningTotal = startingFloat;
    const withRunning = list.map(item => {
      // Sales add to total, trade-ins deduct from total (do not add cash value)
      runningTotal += item.amount; // item.amount is positive for sales, negative for trade-ins
      return {
        ...item,
        runningTotalBalance: runningTotal
      };
    });

    // Apply vendor filter
    const filtered = filterVendorId === 'all' 
      ? withRunning 
      : withRunning.filter(item => item.vendorId === filterVendorId);

    // Apply user chosen display sort order
    if (sortOrder === 'desc') {
      return [...filtered].reverse();
    }
    return filtered;
  }, [daySales, dayTradeIns, startingFloat, filterVendorId, sortOrder]);

  // Copy text report handler
  const handleCopyReport = () => {
    const lines = [
      `📊 NEWTON'S COLLECTABLES — STALL DAILY RUNDOWN`,
      `📅 Date: ${formattedDateHeadline}`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `💰 DAILY CASH RECONCILIATION:`,
      `• Morning Starting Float: £${startingFloat.toFixed(2)}`,
      `• Gross Sales (+): +£${totalSalesGross.toFixed(2)} (${totalSalesCount} items sold)`,
      `• Trade-Ins Deducted (-): -£${totalTradeInsValue.toFixed(2)} (${totalTradeInsCount} trades — does not add cash)`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `⭐ TOTAL (FLOAT + GROSS SALES − TRADE-INS): £${totalBalance.toFixed(2)}`,
      ...(countedCash !== null ? [
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `• Actual Counted Cash: £${countedCash.toFixed(2)}`,
        `• Till Variance vs Total: ${drawerVariance === 0 ? 'Spot-on £0.00 (Balanced ✅)' : (drawerVariance! > 0 ? `+£${drawerVariance!.toFixed(2)} (Over 🟡)` : `-£${Math.abs(drawerVariance!).toFixed(2)} (Short 🔴)`)}`
      ] : []),
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `📈 STALL COMMISSION EARNED: £${totalCommissionEarned.toFixed(2)}`,
      `👥 VENDOR SHARES PAYABLE: £${totalVendorEarnings.toFixed(2)}`,
      `🛒 NET SALES (SALES − TRADES): £${netDailySales.toFixed(2)}`,
      ``,
      `📋 VENDOR ACTIVITY BREAKDOWN:`,
      ...vendorBreakdown
        .filter(vb => vb.hasActivity)
        .map(vb => `• ${vb.vendor.name}: £${vb.grossSales.toFixed(2)} sales (${vb.salesCount} items) | Trade-ins: -£${vb.tradeInsValue.toFixed(2)} | Net: £${vb.netBalance.toFixed(2)}`),
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `Generated by Stall Control at ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
    ];

    const text = lines.join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopiedReport(true);
      setTimeout(() => setCopiedReport(false), 3000);
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Controls: Date Selector & Quick Controls */}
      <div className="bg-white rounded-xl border border-zinc-200 p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-[#7c1d36] text-white text-[9px] font-black px-2 py-0.5 rounded tracking-widest uppercase">
                DAILY FINANCIAL AUDIT
              </span>
              <span className="text-[11px] font-bold text-zinc-500 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Live Reconciliation
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-zinc-900 tracking-tight flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#7c1d36]" />
              {formattedDateHeadline}
            </h2>
            <p className="text-xs text-zinc-500 font-medium mt-0.5">
              Cash draw balance, sales vs trade-in deductions, and vendor breakdown for the market day.
            </p>
          </div>

          {/* Quick Date Buttons & Custom Date Picker */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              id="btn-rundown-today"
              onClick={() => setSelectedDate(getLocalDateKey())}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                isToday 
                  ? 'bg-[#7c1d36] text-white shadow-xs' 
                  : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
              }`}
            >
              Today
            </button>
            <button
              id="btn-rundown-yesterday"
              onClick={() => setSelectedDate(getYesterdayDateKey())}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                isYesterday 
                  ? 'bg-[#7c1d36] text-white shadow-xs' 
                  : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
              }`}
            >
              Yesterday
            </button>
            <div className="relative">
              <input
                id="input-rundown-date"
                type="date"
                value={selectedDate}
                onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                className="px-3 py-1.5 bg-zinc-50 hover:bg-zinc-100 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#7c1d36]"
              />
            </div>
            <button
              id="btn-copy-rundown-report"
              onClick={handleCopyReport}
              className="px-3.5 py-1.5 bg-zinc-900 hover:bg-black text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Copy formatted summary to clipboard"
            >
              {copiedReport ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Report</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* STARTING FLOAT & CASH DRAWER HIGHLIGHT CARD */}
      <div className="bg-gradient-to-br from-[#20050d] via-[#3b0817] to-[#120206] text-white rounded-2xl p-5 sm:p-7 shadow-lg border border-rose-900/50 relative overflow-hidden">
        <div className="absolute right-0 top-0 opacity-10 pointer-events-none transform translate-x-8 -translate-y-8">
          <Wallet className="w-64 h-64 text-rose-300" />
        </div>

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Left Column: Starting Float Setup */}
          <div className="lg:col-span-5 space-y-4 bg-white/5 border border-white/10 p-4 sm:p-5 rounded-xl backdrop-blur-xs">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-wider text-rose-200 flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-amber-400" />
                Morning Starting Float (£)
              </label>
              <span className="text-[10px] text-rose-300/80 font-medium">Auto-saved for {selectedDate}</span>
            </div>

            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xl font-black text-amber-400">
                £
              </span>
              <input
                id="input-starting-float"
                type="number"
                step="1"
                min="0"
                value={startingFloatInput}
                onChange={(e) => handleFloatChange(e.target.value)}
                placeholder="100.00"
                className="w-full pl-9 pr-4 py-2.5 bg-black/40 border border-white/20 rounded-xl text-xl sm:text-2xl font-black text-white focus:outline-none focus:ring-2 focus:ring-amber-400 font-mono tracking-tight"
              />
            </div>

            {/* Quick Float Amount Presets */}
            <div>
              <span className="text-[10px] font-bold text-rose-300/70 uppercase tracking-widest block mb-1.5">
                Quick Presets:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[0, 50, 100, 150, 200, 250, 300].map((preset) => (
                  <button
                    key={preset}
                    id={`btn-preset-float-${preset}`}
                    onClick={() => setFloatPreset(preset)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                      startingFloat === preset
                        ? 'bg-amber-400 text-black border-amber-300 font-black shadow-xs'
                        : 'bg-white/10 hover:bg-white/20 text-rose-100 border-white/15'
                    }`}
                  >
                    £{preset}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: The Main Calculated Total (Float + Gross Sales - Trade-Ins) */}
          <div className="lg:col-span-7 space-y-4">
            <div>
              <span className="bg-amber-400 text-black text-[9px] font-black px-2.5 py-1 rounded uppercase tracking-widest inline-flex items-center gap-1 shadow-xs">
                <Sparkles className="w-3 h-3" />
                TOTAL (FLOAT + GROSS SALES − TRADE-INS)
              </span>
              <div className="mt-2 flex flex-wrap items-baseline gap-3">
                <span className="text-3xl sm:text-5xl font-black tracking-tight text-white font-mono">
                  £{totalBalance.toFixed(2)}
                </span>
                <span className="text-xs sm:text-sm font-bold text-rose-200 bg-white/10 px-3 py-1 rounded-full border border-white/15">
                  Float (£{startingFloat.toFixed(2)}) + Sales (+£{totalSalesGross.toFixed(2)}) − Trades (-£{totalTradeInsValue.toFixed(2)})
                </span>
              </div>
            </div>

            {/* Clear Unified Equation Formula Ribbon */}
            <div className="space-y-1.5">
              <div className="bg-black/40 border border-white/15 rounded-xl p-3 text-xs font-semibold text-rose-100 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-amber-300 font-bold">Float:</span>
                  <span className="font-mono font-bold text-white">£{startingFloat.toFixed(2)}</span>
                </div>
                <span className="text-emerald-400 font-black">+</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-emerald-300 font-bold">Gross Sales:</span>
                  <span className="font-mono font-bold text-emerald-300">+£{totalSalesGross.toFixed(2)}</span>
                </div>
                <span className="text-rose-400 font-black">−</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-rose-300 font-bold">Trade-Ins:</span>
                  <span className="font-mono font-bold text-rose-300">-£{totalTradeInsValue.toFixed(2)}</span>
                </div>
                <span className="text-amber-300 font-black">=</span>
                <div className="flex items-center gap-1.5 bg-amber-400/20 border border-amber-400/40 px-2.5 py-1 rounded">
                  <span className="text-amber-300 font-black">Total:</span>
                  <span className="font-mono font-black text-amber-200">£{totalBalance.toFixed(2)}</span>
                </div>
              </div>
              <p className="text-[11px] text-rose-200/80 italic font-medium px-1">
                * Trade-ins do not add to the cash value, so they are subtracted from the total.
              </p>
            </div>

            {/* End of Day Physical Count Verification input */}
            <div className="pt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-white/10 text-xs">
              <div className="flex items-center gap-2">
                <label className="text-rose-200 font-bold whitespace-nowrap">
                  End of Day Counted Cash (£):
                </label>
                <input
                  id="input-counted-cash"
                  type="number"
                  step="0.01"
                  min="0"
                  value={countedCashInput}
                  onChange={(e) => handleCountedCashChange(e.target.value)}
                  placeholder="Optional physical count"
                  className="w-36 px-2.5 py-1 bg-black/40 border border-white/20 rounded-lg text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-amber-400 font-mono"
                />
              </div>

              {countedCash !== null && drawerVariance !== null && (
                <div className="flex items-center gap-1.5">
                  <span className="text-rose-300 font-semibold">Till Variance:</span>
                  {drawerVariance === 0 ? (
                    <span className="px-2 py-0.5 bg-emerald-500 text-white font-black rounded text-[11px] flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Balanced (£0.00)
                    </span>
                  ) : drawerVariance > 0 ? (
                    <span className="px-2 py-0.5 bg-amber-500 text-black font-black rounded text-[11px]">
                      +£{drawerVariance.toFixed(2)} (Over)
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 bg-red-600 text-white font-black rounded text-[11px]">
                      -£{Math.abs(drawerVariance).toFixed(2)} (Short)
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* THREE-WAY METRIC CARDS: SALES VS TRADE-INS VS STALL COMMISSION */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1. Total Sales of the Day */}
        <div className="bg-white rounded-xl border border-zinc-200 p-5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded uppercase tracking-wider flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-emerald-600" />
              Total Sales In (Gross)
            </span>
            <span className="text-xs font-bold text-zinc-500">{totalSalesCount} transactions</span>
          </div>

          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl sm:text-3xl font-black text-zinc-900 font-mono tracking-tight">
              +£{totalSalesGross.toFixed(2)}
            </span>
          </div>

          <div className="mt-3 pt-3 border-t border-zinc-100 text-xs text-zinc-500 space-y-1">
            <div className="flex justify-between">
              <span>Avg Basket Size:</span>
              <strong className="text-zinc-800 font-mono">
                £{totalSalesCount > 0 ? (totalSalesGross / totalSalesCount).toFixed(2) : '0.00'}
              </strong>
            </div>
            <div className="flex justify-between">
              <span>Vendor Share Payable:</span>
              <strong className="text-emerald-700 font-mono">£{totalVendorEarnings.toFixed(2)}</strong>
            </div>
          </div>
        </div>

        {/* 2. Total Trade-Ins of the Day */}
        <div className="bg-white rounded-xl border border-zinc-200 p-5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-extrabold text-rose-800 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded uppercase tracking-wider flex items-center gap-1">
              <TrendingDown className="w-3 h-3 text-rose-600" />
              Trade-Ins (Minus of Total)
            </span>
            <span className="text-xs font-bold text-zinc-500">{totalTradeInsCount} trades</span>
          </div>

          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl sm:text-3xl font-black text-rose-700 font-mono tracking-tight">
              -£{totalTradeInsValue.toFixed(2)}
            </span>
          </div>

          <div className="mt-3 pt-3 border-t border-zinc-100 text-xs text-zinc-500 space-y-1">
            <div className="flex justify-between">
              <span>Subtracted from Total:</span>
              <strong className="text-rose-600 font-mono">-£{totalTradeInsValue.toFixed(2)}</strong>
            </div>
            <div className="flex justify-between">
              <span>Cash Added:</span>
              <span className="text-zinc-500 font-medium">£0.00 (Cards/Items)</span>
            </div>
          </div>
        </div>

        {/* 3. Newton Stall Revenue & Net Total */}
        <div className="bg-white rounded-xl border border-zinc-200 p-5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-extrabold text-[#7c1d36] bg-rose-50 border border-rose-200 px-2 py-0.5 rounded uppercase tracking-wider flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-[#7c1d36]" />
              Stall Commission & Net
            </span>
            <span className="text-xs font-bold text-zinc-500">Day Cut</span>
          </div>

          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl sm:text-3xl font-black text-[#7c1d36] font-mono tracking-tight">
              £{totalCommissionEarned.toFixed(2)}
            </span>
          </div>

          <div className="mt-3 pt-3 border-t border-zinc-100 text-xs text-zinc-500 space-y-1">
            <div className="flex justify-between">
              <span>Total (Float + Sales − Trades):</span>
              <strong className="font-mono text-emerald-700 font-bold">
                £{totalBalance.toFixed(2)}
              </strong>
            </div>
            <div className="flex justify-between">
              <span>Net Sales (Sales − Trades):</span>
              <strong className="font-mono text-zinc-800">
                £{netDailySales.toFixed(2)}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* VENDOR BREAKDOWN TABLE FOR THE DAY */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden shadow-xs">
        <div className="p-4 sm:p-5 border-b border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-50/70">
          <div>
            <h3 className="text-sm font-extrabold text-zinc-900 tracking-tight flex items-center gap-2">
              <Receipt className="w-4 h-4 text-[#7c1d36]" />
              Vendor Performance & Activity Breakdown ({formattedDateHeadline})
            </h3>
            <p className="text-xs text-zinc-500 font-medium mt-0.5">
              Itemized breakdown of sales generated, trade-in deductions taken, and net earnings per vendor today.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-100/80 text-[10px] font-extrabold text-zinc-600 uppercase tracking-wider">
                <th className="py-3 px-4">Vendor</th>
                <th className="py-3 px-4 text-center">Sales Count</th>
                <th className="py-3 px-4 text-right">Gross Sales (£)</th>
                <th className="py-3 px-4 text-center">Trade-Ins Count</th>
                <th className="py-3 px-4 text-right">Trade-In Deductions (£)</th>
                <th className="py-3 px-4 text-right">Stall Comm (£)</th>
                <th className="py-3 px-4 text-right">Net Day Balance (£)</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {vendorBreakdown.map((vb) => {
                const colorEmoji = getVendorColorEmoji(vb.vendor.color);
                return (
                  <tr 
                    key={vb.vendor.id} 
                    className={`transition-colors ${vb.hasActivity ? 'hover:bg-zinc-50/80' : 'opacity-60 bg-zinc-50/30'}`}
                  >
                    <td className="py-3 px-4 font-bold text-zinc-900 flex items-center gap-2">
                      <div 
                        className="w-3.5 h-3.5 rounded-full border border-black/10 shrink-0" 
                        style={{ backgroundColor: vb.vendor.color || '#64748B' }} 
                      />
                      <span>{vb.vendor.name}</span>
                      <span className="text-[10px] font-semibold text-zinc-400 font-mono">
                        ({(vb.vendor.commission * 100).toFixed(0)}%)
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-zinc-700 font-mono">
                      {vb.salesCount}
                    </td>
                    <td className="py-3 px-4 text-right font-black text-emerald-600 font-mono">
                      £{vb.grossSales.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-zinc-700 font-mono">
                      {vb.tradeInsCount}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-amber-700 font-mono">
                      {vb.tradeInsValue > 0 ? `-£${vb.tradeInsValue.toFixed(2)}` : '£0.00'}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-blue-700 font-mono">
                      £{vb.commission.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-black font-mono">
                      <span className={vb.netBalance >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                        {vb.netBalance >= 0 ? '+' : ''}£{vb.netBalance.toFixed(2)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {onViewVendorProfile && (
                        <button
                          id={`btn-view-vendor-${vb.vendor.id}`}
                          onClick={() => onViewVendorProfile(vb.vendor.id)}
                          className="px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded text-[11px] font-bold transition-all cursor-pointer"
                        >
                          View Profile
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}

              {/* Summary Totals Row */}
              <tr className="bg-zinc-100/90 font-black text-zinc-900 border-t-2 border-zinc-300">
                <td className="py-3.5 px-4 font-black uppercase tracking-wider">
                  TOTALS FOR DAY
                </td>
                <td className="py-3.5 px-4 text-center font-mono text-xs">
                  {totalSalesCount}
                </td>
                <td className="py-3.5 px-4 text-right font-mono text-emerald-700 text-sm">
                  +£{totalSalesGross.toFixed(2)}
                </td>
                <td className="py-3.5 px-4 text-center font-mono text-xs">
                  {totalTradeInsCount}
                </td>
                <td className="py-3.5 px-4 text-right font-mono text-rose-700 text-sm">
                  -£{totalTradeInsValue.toFixed(2)}
                </td>
                <td className="py-3.5 px-4 text-right font-mono text-blue-800 text-sm">
                  £{totalCommissionEarned.toFixed(2)}
                </td>
                <td className="py-3.5 px-4 text-right font-mono text-sm">
                  <span className={netDailySales >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                    {netDailySales >= 0 ? '+' : ''}£{netDailySales.toFixed(2)}
                  </span>
                </td>
                <td className="py-3.5 px-4 text-center text-[10px] text-zinc-500 font-bold">
                  {daySales.length + dayTradeIns.length} records
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* CHRONOLOGICAL DAY LEDGER WITH RUNNING DRAW BALANCE */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden shadow-xs">
        <div className="p-4 sm:p-5 border-b border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-50/70">
          <div>
            <h3 className="text-sm font-extrabold text-zinc-900 tracking-tight flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#7c1d36]" />
              Chronological Till Feed & Draw Balance
            </h3>
            <p className="text-xs text-zinc-500 font-medium mt-0.5">
              Cash drawer grows with sales (+). Trade-in deductions (-) are subtracted from the net total.
            </p>
          </div>

          {/* Filters & Sorting */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              id="select-feed-vendor"
              value={filterVendorId}
              onChange={(e) => setFilterVendorId(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-zinc-300 rounded-lg text-xs font-bold text-zinc-700 cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#7c1d36]"
            >
              <option value="all">All Vendors ({vendors.length})</option>
              {vendors.map(v => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>

            <button
              id="btn-feed-sort"
              onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
              className="px-2.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              {sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}
            </button>
          </div>
        </div>

        {combinedChronology.length === 0 ? (
          <div className="p-12 text-center text-zinc-400">
            <Receipt className="w-12 h-12 mx-auto mb-2 opacity-30 text-zinc-400" />
            <p className="text-sm font-bold text-zinc-600">No transactions recorded for {formattedDateHeadline}</p>
            <p className="text-xs text-zinc-400 mt-1">Log sales or trade-ins from the Joint Register tab to see live draw updates.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-100/80 text-[10px] font-extrabold text-zinc-600 uppercase tracking-wider">
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Vendor</th>
                  <th className="py-3 px-4">Item / Details</th>
                  <th className="py-3 px-4 text-right">Movement</th>
                  <th className="py-3 px-4 text-right">Running Total (Float + Sales − Trades)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 font-medium">
                {combinedChronology.map((item) => {
                  const itemVendor = vendors.find(v => v.id === item.vendorId);
                  const timeFormatted = new Date(item.date).toLocaleTimeString('en-GB', {
                    hour: '2-digit',
                    minute: '2-digit'
                  });

                  return (
                    <tr key={item.id} className="hover:bg-zinc-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-zinc-500 whitespace-nowrap">
                        {timeFormatted}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {item.type === 'sale' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-black text-[10px] uppercase tracking-wider">
                            <ArrowUpRight className="w-3 h-3 text-emerald-600" /> SALE (+ CASH)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-100 text-rose-900 rounded font-black text-[10px] uppercase tracking-wider">
                            <ArrowDownRight className="w-3 h-3 text-rose-700" /> TRADE-IN (− DEDUCT)
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-bold text-zinc-900 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <div 
                            className="w-2.5 h-2.5 rounded-full shrink-0" 
                            style={{ backgroundColor: itemVendor?.color || '#64748B' }} 
                          />
                          <span>{item.vendorName}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-zinc-800 font-semibold max-w-xs truncate">
                        {item.title}
                      </td>
                      <td className="py-3 px-4 text-right font-black font-mono whitespace-nowrap">
                        <span className={item.amount >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                          {item.amount >= 0 ? '+' : ''}£{item.amount.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-black font-mono text-zinc-900 whitespace-nowrap bg-zinc-50/50 text-sm">
                        £{item.runningTotalBalance.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
