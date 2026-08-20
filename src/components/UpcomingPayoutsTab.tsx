import React, { useState } from 'react';
import { 
  Calendar, 
  DollarSign, 
  Clock, 
  TrendingUp, 
  CheckCircle2, 
  Filter, 
  Search, 
  Download, 
  ChevronDown, 
  ChevronUp, 
  Coins, 
  AlertCircle, 
  ArrowUpRight,
  UserCheck,
  FileText,
  ShoppingBag,
  Edit2,
  Trash2,
  X,
  RefreshCw,
  ShieldCheck,
  Scale,
  ArrowDownRight
} from 'lucide-react';
import { Vendor, Sale, CashoutRequest, TradeIn } from '../types';
import { 
  isSaleMature, 
  getPayoutDate, 
  getRemainingDays, 
  getTimeLeftFormatted, 
  calculateVendorBalances,
  getWeekOfYear
} from '../payoutUtils';
import { downloadVendorClearedBalancePDF, downloadStandaloneWeeklyVendorPayoutPDF } from '../pdfUtils';

interface UpcomingPayoutsTabProps {
  vendors: Vendor[];
  sales: Sale[];
  cashouts: CashoutRequest[];
  tradeIns: TradeIn[];
  onViewVendorProfile?: (vendorId: string) => void;
  onUpdateSale?: (saleId: string, saleData: {
    vendorId: string;
    itemName: string;
    price: number;
    date: string;
  }) => Promise<void>;
  onDeleteSale?: (saleId: string) => Promise<void>;
}

export default function UpcomingPayoutsTab({
  vendors,
  sales,
  cashouts,
  tradeIns,
  onViewVendorProfile,
  onUpdateSale,
  onDeleteSale
}: UpcomingPayoutsTabProps) {
  const [selectedVendorFilter, setSelectedVendorFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'schedule' | 'vendors'>('schedule');
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});

  // Edit Sale Modal State
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);
  const [saleVendorId, setSaleVendorId] = useState<string>('');
  const [saleItemName, setSaleItemName] = useState<string>('');
  const [salePrice, setSalePrice] = useState<string>('');
  const [saleDate, setSaleDate] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [editSuccessMsg, setEditSuccessMsg] = useState<string>('');
  const [editErrorMsg, setEditErrorMsg] = useState<string>('');

  const handleStartEdit = (sale: Sale) => {
    setEditingSaleId(sale.id);
    setSaleVendorId(sale.vendorId);
    setSaleItemName(sale.itemName);
    setSalePrice(sale.price.toString());
    const dateObj = new Date(sale.date);
    const formattedDate = new Date(dateObj.getTime() - dateObj.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setSaleDate(formattedDate);
    setEditErrorMsg('');
    setEditSuccessMsg('');
  };

  const handleSaveSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSaleId || !onUpdateSale) return;
    setIsSaving(true);
    setEditErrorMsg('');
    try {
      const priceNum = Number(salePrice);
      if (isNaN(priceNum) || priceNum < 0) {
        setEditErrorMsg('Please enter a valid price.');
        setIsSaving(false);
        return;
      }
      const isoDate = new Date(saleDate).toISOString();
      await onUpdateSale(editingSaleId, {
        vendorId: saleVendorId,
        itemName: saleItemName.trim(),
        price: priceNum,
        date: isoDate
      });
      setEditSuccessMsg('Transaction updated! Payout schedule recalculated.');
      setTimeout(() => {
        setEditingSaleId(null);
        setEditSuccessMsg('');
      }, 1000);
    } catch (err: any) {
      setEditErrorMsg(err.message || 'Failed to update transaction.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSale = async (saleId: string) => {
    if (!onDeleteSale) return;
    if (!window.confirm('Are you sure you want to delete this sale record?')) return;
    setIsDeleting(saleId);
    try {
      await onDeleteSale(saleId);
    } catch (err) {
      console.error('Failed to delete sale:', err);
    } finally {
      setIsDeleting(null);
    }
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

  const now = new Date();

  // Calculate Vendor Balances for all vendors
  const vendorBalancesMap = vendors.map((vendor) => {
    const summary = calculateVendorBalances(vendor, sales, cashouts, now);
    return {
      vendor,
      summary
    };
  });

  // Grand Totals across all stalls (accounting for trade-in deductions)
  const totalClearedFunds = vendorBalancesMap.reduce((acc, v) => acc + v.summary.availableCash, 0);
  const totalRawClearFunds = vendorBalancesMap.reduce((acc, v) => acc + v.summary.rawClearFunds, 0);
  const totalTradeInDeductionsClear = vendorBalancesMap.reduce((acc, v) => acc + v.summary.tradeInDeductedFromClear, 0);

  const totalPendingPayouts = vendorBalancesMap.reduce((acc, v) => acc + v.summary.pendingCash, 0);
  const totalRawPendingFunds = vendorBalancesMap.reduce((acc, v) => acc + v.summary.rawPendingFunds, 0);
  const totalTradeInDeductionsPending = vendorBalancesMap.reduce((acc, v) => acc + v.summary.tradeInDeductedFromPending, 0);

  const totalSpentOnTradeIns = vendorBalancesMap.reduce((acc, v) => acc + v.summary.spentOnTradeIns, 0);
  const totalPendingCashoutsAmt = vendorBalancesMap.reduce((acc, v) => acc + v.summary.pendingCashoutsAmount, 0);
  const totalOutstandingBalance = totalClearedFunds + totalPendingPayouts + totalPendingCashoutsAmt;

  // Filter sales based on selected vendor and search query
  const eligibleUncashedSales = sales.filter((sale) => {
    if (sale.cashedOut) return false;
    if (sale.cashoutRequestId) return false; // In a pending request
    if (selectedVendorFilter !== 'ALL' && sale.vendorId !== selectedVendorFilter) return false;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const vendorName = vendors.find((v) => v.id === sale.vendorId)?.name.toLowerCase() || '';
      const itemName = sale.itemName.toLowerCase();
      return itemName.includes(query) || vendorName.includes(query);
    }
    return true;
  });

  // Group uncashed sales by Friday payout date
  interface PayoutGroup {
    dateKey: string;              // YYYY-MM-DD
    payoutDate: Date;             // Date object
    formattedDate: string;        // e.g. "Friday, 22 Aug 2026"
    weekNumber: number;           // Week of year
    isMature: boolean;
    remainingDays: number;
    totalGross: number;
    totalGrossEarnings: number;
    totalTradeInDeductions: number;
    totalNetClearingFunds: number;
    sales: Sale[];
    vendorTotals: Record<string, { 
      vendor: Vendor; 
      grossEarnings: number; 
      tradeInDeduction: number; 
      netClearingFunds: number; 
      count: number;
    }>;
  }

  const payoutGroupsMap: Record<string, PayoutGroup> = {};

  eligibleUncashedSales.forEach((sale) => {
    const pDate = getPayoutDate(sale.date);
    const dateKey = `${pDate.getFullYear()}-${String(pDate.getMonth() + 1).padStart(2, '0')}-${String(pDate.getDate()).padStart(2, '0')}`;
    const vendor = vendors.find((v) => v.id === sale.vendorId);

    if (!payoutGroupsMap[dateKey]) {
      const isMature = isSaleMature(sale.date, now);
      const remainingDays = getRemainingDays(sale.date, now);
      const weekNumber = getWeekOfYear(pDate);
      const formattedDate = pDate.toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });

      payoutGroupsMap[dateKey] = {
        dateKey,
        payoutDate: pDate,
        formattedDate,
        weekNumber,
        isMature,
        remainingDays,
        totalGross: 0,
        totalGrossEarnings: 0,
        totalTradeInDeductions: 0,
        totalNetClearingFunds: 0,
        sales: [],
        vendorTotals: {}
      };
    }

    const group = payoutGroupsMap[dateKey];
    group.totalGross += sale.price;
    group.totalGrossEarnings += sale.vendorEarnings;
    group.sales.push(sale);

    if (vendor) {
      if (!group.vendorTotals[vendor.id]) {
        group.vendorTotals[vendor.id] = { 
          vendor, 
          grossEarnings: 0, 
          tradeInDeduction: 0, 
          netClearingFunds: 0, 
          count: 0 
        };
      }
      group.vendorTotals[vendor.id].grossEarnings += sale.vendorEarnings;
      group.vendorTotals[vendor.id].count += 1;
    }
  });

  // Sort groups by payout date ascending
  const sortedPayoutGroups = Object.values(payoutGroupsMap).sort(
    (a, b) => a.payoutDate.getTime() - b.payoutDate.getTime()
  );

  // Apply chronological trade-in deductions per vendor across Friday payout dates
  const vendorRemainingTradeExpense: Record<string, number> = {};
  vendorBalancesMap.forEach(({ vendor, summary }) => {
    vendorRemainingTradeExpense[vendor.id] = summary.spentOnTradeIns || 0;
  });

  sortedPayoutGroups.forEach((group) => {
    let groupTradeInDeductions = 0;
    let groupNetClearingFunds = 0;

    Object.keys(group.vendorTotals).forEach((vendorId) => {
      const vInfo = group.vendorTotals[vendorId];
      const unappliedExpense = vendorRemainingTradeExpense[vendorId] || 0;
      const deduction = Math.min(vInfo.grossEarnings, unappliedExpense);
      const netClearing = Math.max(0, vInfo.grossEarnings - deduction);

      vInfo.tradeInDeduction = deduction;
      vInfo.netClearingFunds = netClearing;
      vendorRemainingTradeExpense[vendorId] = Math.max(0, unappliedExpense - deduction);

      groupTradeInDeductions += deduction;
      groupNetClearingFunds += netClearing;
    });

    group.totalTradeInDeductions = groupTradeInDeductions;
    group.totalNetClearingFunds = groupNetClearingFunds;
  });

  const toggleExpandDate = (dateKey: string) => {
    setExpandedDates((prev) => ({ ...prev, [dateKey]: !prev[dateKey] }));
  };

  return (
    <div className="space-y-6">
      {/* Top Header Banner */}
      <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-xs">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-zinc-900 uppercase tracking-wider">
                  Upcoming Payouts Totals
                </h2>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Live Market Ledger
                </span>
              </div>
              <p className="text-xs text-zinc-500 font-medium mt-0.5">
                Friday payout maturation schedule for all Newton's Collectables stall owners (Wed sales: 16 days • Sat sales: 13 days).
              </p>
            </div>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1.5 bg-zinc-100 p-1 rounded-lg border border-zinc-200/80 self-start md:self-auto">
            <button
              id="btn-view-schedule"
              type="button"
              onClick={() => setViewMode('schedule')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                viewMode === 'schedule'
                  ? 'bg-white text-blue-600 shadow-xs border border-zinc-200/60'
                  : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              📅 Schedule By Friday Date
            </button>
            <button
              id="btn-view-vendors"
              type="button"
              onClick={() => setViewMode('vendors')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                viewMode === 'vendors'
                  ? 'bg-white text-blue-600 shadow-xs border border-zinc-200/60'
                  : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              📊 Vendor Breakdown
            </button>
          </div>
        </div>

        {/* Informative Net Funds Clarification Callout */}
        <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center gap-2.5 text-xs text-zinc-700 bg-zinc-50/80 px-3.5 py-2 rounded-lg border border-zinc-200/60">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-semibold leading-relaxed">
            <strong className="text-zinc-900 font-black">Net Cleared Funds Rule:</strong> All upcoming payout figures display the <strong>exact net amount that will clear into stall funds</strong>, after applying automatic reductions for register card trade-ins and stock acquisitions.
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Cleared Funds (Immediate) */}
        <div className="bg-white border border-emerald-200 rounded-xl p-4 shadow-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-full blur-xl -mr-6 -mt-6 pointer-events-none" />
          <div className="flex items-center justify-between relative z-10">
            <span className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-widest">
              Cleared & Ready Today (Net)
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-3 relative z-10">
            <span className="text-2xl font-black text-emerald-700">
              £{totalClearedFunds.toFixed(2)}
            </span>
            <div className="mt-1">
              {totalTradeInDeductionsClear > 0 ? (
                <span className="text-[10px] font-bold text-emerald-800/80 block bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/50">
                  Gross: £{totalRawClearFunds.toFixed(2)} • Trade-ins: -£{totalTradeInDeductionsClear.toFixed(2)}
                </span>
              ) : (
                <span className="text-[11px] font-bold text-emerald-600/80 block">
                  Available for immediate Friday cashout
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Total Upcoming Pending Payouts */}
        <div className="bg-white border border-blue-200 rounded-xl p-4 shadow-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-full blur-xl -mr-6 -mt-6 pointer-events-none" />
          <div className="flex items-center justify-between relative z-10">
            <span className="text-[10px] font-extrabold text-blue-700 uppercase tracking-widest">
              Upcoming Pending (Net Clearing)
            </span>
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-3 relative z-10">
            <span className="text-2xl font-black text-blue-700">
              £{totalPendingPayouts.toFixed(2)}
            </span>
            <div className="mt-1">
              {totalTradeInDeductionsPending > 0 ? (
                <span className="text-[10px] font-bold text-blue-800/80 block bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200/50">
                  Gross: £{totalRawPendingFunds.toFixed(2)} • Trade-ins: -£{totalTradeInDeductionsPending.toFixed(2)}
                </span>
              ) : (
                <span className="text-[11px] font-bold text-blue-600/80 block">
                  Maturing across future Friday dates
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Trade-In Deductions Applied */}
        <div className="bg-white border border-rose-200 rounded-xl p-4 shadow-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-50 rounded-full blur-xl -mr-6 -mt-6 pointer-events-none" />
          <div className="flex items-center justify-between relative z-10">
            <span className="text-[10px] font-extrabold text-rose-700 uppercase tracking-widest">
              Trade-In Deductions Applied
            </span>
            <Coins className="w-4 h-4 text-rose-600" />
          </div>
          <div className="mt-3 relative z-10">
            <span className="text-2xl font-black text-rose-700">
              £{totalSpentOnTradeIns.toFixed(2)}
            </span>
            <span className="text-[10px] font-bold text-rose-600/90 block mt-1">
              Mature: -£{totalTradeInDeductionsClear.toFixed(2)} • Pending: -£{totalTradeInDeductionsPending.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Total Outstanding Combined */}
        <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between relative z-10">
            <span className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-widest">
              Total Net Funds Clearing
            </span>
            <TrendingUp className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="mt-3 relative z-10">
            <span className="text-2xl font-black text-zinc-900">
              £{totalOutstandingBalance.toFixed(2)}
            </span>
            <span className="text-[11px] font-bold text-zinc-500 block mt-1">
              Combined net cleared + pending stall funds
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-zinc-400 shrink-0" />
          <span className="text-xs font-extrabold text-zinc-600 uppercase tracking-wider whitespace-nowrap">
            Filter Vendor:
          </span>
          <select
            id="filter-vendor-payouts"
            value={selectedVendorFilter}
            onChange={(e) => setSelectedVendorFilter(e.target.value)}
            className="bg-zinc-50 border border-zinc-200 hover:border-zinc-300 focus:bg-white text-xs font-bold rounded-lg py-2 px-3 outline-none text-zinc-700 cursor-pointer transition-all w-full sm:w-48"
          >
            <option value="ALL">All Stalls / Vendors ({vendors.length})</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {getVendorColorEmoji(v.color)} {v.name}
              </option>
            ))}
          </select>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            id="search-payouts"
            type="text"
            placeholder="Search card or vendor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-50 border border-zinc-200 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-600 text-xs rounded-lg py-2 pl-9 pr-3 outline-none font-semibold text-zinc-700 transition-all"
          />
        </div>
      </div>

      {/* VIEW MODE 1: SCHEDULE BY FRIDAY DATE */}
      {viewMode === 'schedule' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-xs font-black text-zinc-800 uppercase tracking-wider flex items-center gap-2">
              <span>Friday Payout Schedule</span>
              <span className="bg-zinc-100 text-zinc-600 text-[10px] font-bold px-2 py-0.5 rounded">
                {sortedPayoutGroups.length} Payout Dates
              </span>
            </h3>
          </div>

          {sortedPayoutGroups.length === 0 ? (
            <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center shadow-xs">
              <Calendar className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-zinc-800">No Upcoming Payout Transactions</h4>
              <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
                No active card transactions match your current search/filter criteria.
              </p>
            </div>
          ) : (
            sortedPayoutGroups.map((group) => {
              const isExpanded = !!expandedDates[group.dateKey];
              const vendorList = Object.values(group.vendorTotals);

              return (
                <div
                  key={group.dateKey}
                  className={`bg-white border rounded-xl overflow-hidden shadow-xs transition-all ${
                    group.isMature
                      ? 'border-emerald-300/80 ring-1 ring-emerald-100'
                      : 'border-zinc-200'
                  }`}
                >
                  {/* Friday Date Group Header */}
                  <div
                    onClick={() => toggleExpandDate(group.dateKey)}
                    className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none transition-colors ${
                      group.isMature ? 'bg-emerald-50/50 hover:bg-emerald-50' : 'bg-zinc-50/70 hover:bg-zinc-100/70'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-black text-xs ${
                          group.isMature
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-blue-600 text-white shadow-xs'
                        }`}
                      >
                        {group.payoutDate.getDate()}
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-sm font-black text-zinc-900">
                            {group.formattedDate}
                          </h4>
                          <span className="bg-zinc-200/80 text-zinc-800 text-[10px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wider">
                            Week {group.weekNumber}
                          </span>
                          {group.isMature ? (
                            <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 uppercase tracking-wider">
                              <CheckCircle2 className="w-3 h-3" /> Mature & Cleared Today
                            </span>
                          ) : (
                            <span className="bg-blue-100 text-blue-800 border border-blue-200 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 uppercase tracking-wider">
                              <Clock className="w-3 h-3 text-blue-600" /> Maturing in {group.remainingDays} days
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <p className="text-[11px] text-zinc-500 font-semibold">
                            {group.sales.length} card {group.sales.length === 1 ? 'sale' : 'sales'} maturing for {vendorList.length} {vendorList.length === 1 ? 'vendor' : 'vendors'}
                          </p>
                          {group.totalTradeInDeductions > 0 && (
                            <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                              📉 Reduced by £{group.totalTradeInDeductions.toFixed(2)} for register trade-ins
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3">
                      <div className="text-right">
                        <span className="text-[10px] font-extrabold text-zinc-400 block uppercase tracking-widest">
                          {group.isMature ? 'Cleared Funds Ready' : 'Net Funds That Will Clear'}
                        </span>
                        <div className="flex items-baseline justify-end gap-1.5">
                          <span className={`text-lg font-black ${group.isMature ? 'text-emerald-700' : 'text-zinc-900'}`}>
                            £{group.totalNetClearingFunds.toFixed(2)}
                          </span>
                          {group.totalTradeInDeductions > 0 && (
                            <span className="text-[11px] font-semibold text-zinc-400 line-through">
                              £{group.totalGrossEarnings.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Standalone Payout PDF Download Button for this Week */}
                      <button
                        type="button"
                        id={`btn-standalone-pdf-group-wk-${group.weekNumber}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          vendorList.forEach(({ vendor }) => {
                            const vendorSalesForWeek = group.sales.filter((s) => s.vendorId === vendor.id);
                            downloadStandaloneWeeklyVendorPayoutPDF({
                              vendor,
                              weekNumber: group.weekNumber,
                              payoutDate: group.payoutDate,
                              formattedPayoutDate: group.formattedDate,
                              sales: vendorSalesForWeek,
                            });
                          });
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-xs font-black transition-all shadow-2xs cursor-pointer active:scale-95"
                        title={`Download standalone Week ${group.weekNumber} payout PDF for vendor(s)`}
                      >
                        <FileText className="w-3.5 h-3.5 text-amber-400" />
                        <span className="hidden sm:inline">Week {group.weekNumber} PDF</span>
                        <span className="sm:hidden">PDF</span>
                      </button>

                      <button
                        type="button"
                        className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded-lg border border-zinc-200/80 bg-white shadow-2xs"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Vendor Earnings Pills Summary */}
                  <div className="px-4 py-3 bg-white border-t border-zinc-100 flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest mr-1">
                      Stall Cleared Funds:
                    </span>
                    {vendorList.map(({ vendor, grossEarnings, tradeInDeduction, netClearingFunds, count }) => (
                      <div
                        key={vendor.id}
                        className="inline-flex items-center gap-1.5 bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-1 text-xs font-bold text-zinc-800"
                      >
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: vendor.color || '#3B82F6' }}
                        />
                        <span>{vendor.name}:</span>
                        <span className="text-emerald-700 font-black">£{netClearingFunds.toFixed(2)}</span>
                        {tradeInDeduction > 0 ? (
                          <span className="text-[10px] font-semibold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200/60">
                            (Gross £{grossEarnings.toFixed(2)} - Trade-in £{tradeInDeduction.toFixed(2)})
                          </span>
                        ) : (
                          <span className="text-[10px] font-normal text-zinc-400">({count})</span>
                        )}

                        <button
                          type="button"
                          id={`btn-standalone-pdf-wk-${group.weekNumber}-vendor-${vendor.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            const vendorSalesForWeek = group.sales.filter((s) => s.vendorId === vendor.id);
                            downloadStandaloneWeeklyVendorPayoutPDF({
                              vendor,
                              weekNumber: group.weekNumber,
                              payoutDate: group.payoutDate,
                              formattedPayoutDate: group.formattedDate,
                              sales: vendorSalesForWeek,
                            });
                          }}
                          className="ml-1 inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/80 rounded text-[10px] font-bold transition-all cursor-pointer hover:shadow-2xs"
                          title={`Download standalone Week ${group.weekNumber} payout PDF for ${vendor.name} (Contains no info about other weeks)`}
                        >
                          <Download className="w-2.5 h-2.5 text-blue-600" />
                          <span>PDF</span>
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Expanded Itemized Sales List */}
                  {isExpanded && (
                    <div className="border-t border-zinc-200 bg-zinc-50/50 p-4 animate-in fade-in duration-150">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                        <h5 className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest">
                          Itemized Transactions Maturing On This Date
                        </h5>
                        {group.totalTradeInDeductions > 0 && (
                          <div className="text-[11px] font-bold text-zinc-700 bg-white border border-zinc-200 px-2.5 py-1 rounded-md shadow-2xs">
                            Formula: Gross Sales <span className="font-extrabold text-zinc-900">£{group.totalGrossEarnings.toFixed(2)}</span> — Trade-Ins <span className="font-extrabold text-rose-600">-£{group.totalTradeInDeductions.toFixed(2)}</span> = <span className="font-black text-emerald-700">£{group.totalNetClearingFunds.toFixed(2)} Net Clearing</span>
                          </div>
                        )}
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-zinc-200 text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider">
                              <th className="pb-2 pr-3">Vendor / Stall</th>
                              <th className="pb-2 pr-3">Item Description</th>
                              <th className="pb-2 pr-3 text-right">Sale Price</th>
                              <th className="pb-2 pr-3 text-right">Vendor Net</th>
                              <th className="pb-2 pr-3 text-right">Date Sold</th>
                              <th className="pb-2 text-center">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-200/60 font-semibold text-zinc-700">
                            {group.sales.map((sale) => {
                              const vendor = vendors.find((v) => v.id === sale.vendorId);
                              return (
                                <tr key={sale.id} className="hover:bg-white/80 transition-colors">
                                  <td className="py-2.5 pr-3">
                                    <div className="flex items-center gap-2">
                                      <div
                                        className="w-2.5 h-2.5 rounded-full shrink-0"
                                        style={{ backgroundColor: vendor?.color || '#64748B' }}
                                      />
                                      <span className="font-bold text-zinc-900">{vendor?.name || 'Unknown'}</span>
                                    </div>
                                  </td>
                                  <td className="py-2.5 pr-3 font-medium text-zinc-800">{sale.itemName}</td>
                                  <td className="py-2.5 pr-3 text-right text-zinc-500 font-medium">£{sale.price.toFixed(2)}</td>
                                  <td className="py-2.5 pr-3 text-right font-black text-blue-600">£{sale.vendorEarnings.toFixed(2)}</td>
                                  <td className="py-2.5 pr-3 text-right text-zinc-400 text-[11px]">
                                    {new Date(sale.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                  </td>
                                  <td className="py-2.5 text-center whitespace-nowrap">
                                    <div className="flex items-center justify-center gap-1">
                                      {onUpdateSale && (
                                        <button
                                          type="button"
                                          id={`btn-edit-payout-sale-${sale.id}`}
                                          onClick={() => handleStartEdit(sale)}
                                          className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-all cursor-pointer"
                                          title="Edit Price, Date, Vendor or Description"
                                        >
                                          <Edit2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                      {onDeleteSale && (
                                        <button
                                          type="button"
                                          id={`btn-delete-payout-sale-${sale.id}`}
                                          onClick={() => handleDeleteSale(sale.id)}
                                          disabled={isDeleting === sale.id}
                                          className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-all cursor-pointer"
                                          title="Delete Sale Record"
                                        >
                                          {isDeleting === sale.id ? (
                                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                          ) : (
                                            <Trash2 className="w-3.5 h-3.5" />
                                          )}
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* VIEW MODE 2: VENDOR BREAKDOWN TABLE */}
      {viewMode === 'vendors' && (
        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-xs">
          <div className="p-4 bg-zinc-50/80 border-b border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-black text-zinc-900 uppercase tracking-wider">
                Vendor Stall Payout Summary & Ledger
              </h3>
              <p className="text-[11px] text-zinc-500 font-medium">
                Comprehensive balance sheet showing gross sales, register trade-in reductions, cleared funds, and net balances.
              </p>
            </div>
            <div className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md self-start sm:self-auto">
              Net Cleared Funds = Gross Mature − Trade-Ins
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-zinc-100/70 border-b border-zinc-200 text-[10px] font-extrabold text-zinc-500 uppercase tracking-widest">
                  <th className="py-3 px-4">Stall / Vendor</th>
                  <th className="py-3 px-4 text-right">Gross Mature (£)</th>
                  <th className="py-3 px-4 text-right">Gross Pending (£)</th>
                  <th className="py-3 px-4 text-right">Trade-In Deductions</th>
                  <th className="py-3 px-4 text-right">Cleared Today (Net)</th>
                  <th className="py-3 px-4 text-right">Upcoming Pending (Net)</th>
                  <th className="py-3 px-4 text-right">Pending Cashouts</th>
                  <th className="py-3 px-4 text-right">Net Funds to Clear</th>
                  <th className="py-3 px-4 text-center">PDF Statement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 font-semibold text-zinc-800">
                {vendorBalancesMap
                  .filter(({ vendor }) => selectedVendorFilter === 'ALL' || vendor.id === selectedVendorFilter)
                  .map(({ vendor, summary }) => (
                    <tr key={vendor.id} className="hover:bg-zinc-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-3.5 h-3.5 rounded-full shrink-0 shadow-2xs"
                            style={{ backgroundColor: vendor.color || '#3B82F6' }}
                          />
                          <div>
                            <span className="font-extrabold text-zinc-900 text-xs block">
                              {vendor.name}
                            </span>
                            <span className="text-[10px] text-zinc-400 font-medium block">
                              Commission: {(vendor.commission * 100).toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Gross Mature */}
                      <td className="py-3 px-4 text-right">
                        <span className="text-zinc-600 font-semibold">
                          £{summary.rawClearFunds.toFixed(2)}
                        </span>
                      </td>

                      {/* Gross Pending */}
                      <td className="py-3 px-4 text-right">
                        <span className="text-zinc-600 font-semibold">
                          £{summary.rawPendingFunds.toFixed(2)}
                        </span>
                      </td>

                      {/* Trade-In Deductions */}
                      <td className="py-3 px-4 text-right">
                        {summary.spentOnTradeIns > 0 ? (
                          <div className="inline-flex flex-col items-end">
                            <span className="font-extrabold text-rose-700 bg-rose-50 border border-rose-200/60 px-2 py-0.5 rounded text-[11px]">
                              -£{summary.spentOnTradeIns.toFixed(2)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-zinc-400 text-xs">—</span>
                        )}
                      </td>

                      {/* Cleared Today (Net) */}
                      <td className="py-3 px-4 text-right">
                        <span className={`font-black ${summary.availableCash > 0 ? 'text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60' : 'text-zinc-400'}`}>
                          £{summary.availableCash.toFixed(2)}
                        </span>
                      </td>

                      {/* Pending Upcoming (Net) */}
                      <td className="py-3 px-4 text-right">
                        <span className={`font-black ${summary.pendingCash > 0 ? 'text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200/60' : 'text-zinc-400'}`}>
                          £{summary.pendingCash.toFixed(2)}
                        </span>
                      </td>

                      {/* Pending Cashouts */}
                      <td className="py-3 px-4 text-right">
                        {summary.pendingCashoutsAmount > 0 ? (
                          <span className="font-extrabold text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-[11px]">
                            £{summary.pendingCashoutsAmount.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-zinc-400 text-xs">—</span>
                        )}
                      </td>

                      {/* Consolidated Total Net Funds */}
                      <td className="py-3 px-4 text-right">
                        <span className="font-black text-zinc-950 text-sm">
                          £{summary.consolidatedBalance.toFixed(2)}
                        </span>
                      </td>

                      {/* Actions / PDF */}
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => downloadVendorClearedBalancePDF(vendor, sales, cashouts)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 rounded text-[10px] font-bold text-zinc-700 transition-colors cursor-pointer"
                          title={`Download PDF statement for ${vendor.name}`}
                        >
                          <Download className="w-3 h-3 text-blue-600" />
                          <span>PDF</span>
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
              <tfoot className="bg-zinc-100/90 border-t-2 border-zinc-300 font-extrabold text-zinc-900 text-xs">
                <tr>
                  <td className="py-3 px-4 uppercase tracking-wider text-[11px] text-zinc-700">Totals Across Stalls:</td>
                  <td className="py-3 px-4 text-right text-zinc-700">£{totalRawClearFunds.toFixed(2)}</td>
                  <td className="py-3 px-4 text-right text-zinc-700">£{totalRawPendingFunds.toFixed(2)}</td>
                  <td className="py-3 px-4 text-right text-rose-700">
                    {totalSpentOnTradeIns > 0 ? `-£${totalSpentOnTradeIns.toFixed(2)}` : '£0.00'}
                  </td>
                  <td className="py-3 px-4 text-right text-emerald-800 font-black">£{totalClearedFunds.toFixed(2)}</td>
                  <td className="py-3 px-4 text-right text-blue-800 font-black">£{totalPendingPayouts.toFixed(2)}</td>
                  <td className="py-3 px-4 text-right text-amber-800">£{totalPendingCashoutsAmt.toFixed(2)}</td>
                  <td className="py-3 px-4 text-right text-zinc-950 text-sm font-black">£{totalOutstandingBalance.toFixed(2)}</td>
                  <td className="py-3 px-4"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Edit Sale Modal */}
      {editingSaleId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="bg-white rounded-xl shadow-xl border border-zinc-200 w-full max-w-md overflow-hidden text-left">
            <div className="p-4 border-b border-zinc-200 bg-zinc-50/80 flex justify-between items-center">
              <div>
                <h4 className="text-xs font-black text-zinc-900 uppercase tracking-wider flex items-center gap-2">
                  <Edit2 className="w-4 h-4 text-blue-600" />
                  Edit Processed Sale
                </h4>
                <p className="text-[10px] text-zinc-500 font-medium">
                  Modifying date or price recalculates the Friday payout schedule automatically.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingSaleId(null)}
                className="text-zinc-400 hover:text-zinc-600 font-bold p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSale} className="p-5 space-y-4">
              {editSuccessMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{editSuccessMsg}</span>
                </div>
              )}

              {editErrorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{editErrorMsg}</span>
                </div>
              )}

              <div>
                <label className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider block mb-1">
                  Vendor / Stall Owner
                </label>
                <select
                  required
                  value={saleVendorId}
                  onChange={(e) => setSaleVendorId(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 focus:bg-white text-xs font-bold rounded-lg py-2.5 px-3 outline-none text-zinc-800"
                >
                  <option value="">-- Select Vendor --</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {getVendorColorEmoji(v.color)} {v.name} (Commission: {(v.commission * 100).toFixed(1)}%)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider block mb-1">
                  Item Description / Name
                </label>
                <input
                  type="text"
                  required
                  value={saleItemName}
                  onChange={(e) => setSaleItemName(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 focus:bg-white text-xs font-semibold rounded-lg py-2.5 px-3 outline-none text-zinc-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider block mb-1">
                    Sale Price (£)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    min="0.01"
                    value={salePrice}
                    onChange={(e) => setSalePrice(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-200 focus:bg-white text-xs font-black text-blue-600 rounded-lg py-2.5 px-3 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider block mb-1">
                    Sale Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={saleDate}
                    onChange={(e) => setSaleDate(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-200 focus:bg-white text-xs font-bold text-zinc-800 rounded-lg py-2.5 px-3 outline-none"
                  />
                </div>
              </div>

              {/* Live Friday Payout Recalculation Preview */}
              {saleDate && !isNaN(new Date(saleDate).getTime()) && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs">
                  <span className="text-[10px] font-extrabold text-blue-800 uppercase tracking-wider block">
                    Recalculated Friday Payout Schedule:
                  </span>
                  <div className="mt-1 flex items-center justify-between font-bold text-blue-900">
                    <span>
                      {getPayoutDate(new Date(saleDate)).toLocaleDateString('en-GB', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </span>
                    <span className="bg-blue-200 text-blue-900 text-[10px] px-2 py-0.5 rounded font-black">
                      Week {getWeekOfYear(getPayoutDate(new Date(saleDate)))}
                    </span>
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-zinc-200 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setEditingSaleId(null)}
                  className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 rounded-lg text-xs font-bold text-zinc-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-extrabold transition-all shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    'Save & Recalculate'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
