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
  ShoppingBag
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
import { downloadVendorClearedBalancePDF } from '../pdfUtils';

interface UpcomingPayoutsTabProps {
  vendors: Vendor[];
  sales: Sale[];
  cashouts: CashoutRequest[];
  tradeIns: TradeIn[];
  onViewVendorProfile?: (vendorId: string) => void;
}

export default function UpcomingPayoutsTab({
  vendors,
  sales,
  cashouts,
  tradeIns,
  onViewVendorProfile
}: UpcomingPayoutsTabProps) {
  const [selectedVendorFilter, setSelectedVendorFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'schedule' | 'vendors'>('schedule');
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});

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

  // Grand Totals across all stalls
  const totalClearedFunds = vendorBalancesMap.reduce((acc, v) => acc + v.summary.availableCash, 0);
  const totalPendingPayouts = vendorBalancesMap.reduce((acc, v) => acc + v.summary.pendingCash, 0);
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
    totalEarnings: number;
    sales: Sale[];
    vendorTotals: Record<string, { vendor: Vendor; earnings: number; count: number }>;
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
        totalEarnings: 0,
        sales: [],
        vendorTotals: {}
      };
    }

    const group = payoutGroupsMap[dateKey];
    group.totalGross += sale.price;
    group.totalEarnings += sale.vendorEarnings;
    group.sales.push(sale);

    if (vendor) {
      if (!group.vendorTotals[vendor.id]) {
        group.vendorTotals[vendor.id] = { vendor, earnings: 0, count: 0 };
      }
      group.vendorTotals[vendor.id].earnings += sale.vendorEarnings;
      group.vendorTotals[vendor.id].count += 1;
    }
  });

  // Sort groups by payout date ascending
  const sortedPayoutGroups = Object.values(payoutGroupsMap).sort(
    (a, b) => a.payoutDate.getTime() - b.payoutDate.getTime()
  );

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
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Cleared Funds (Immediate) */}
        <div className="bg-white border border-emerald-200 rounded-xl p-4 shadow-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-full blur-xl -mr-6 -mt-6 pointer-events-none" />
          <div className="flex items-center justify-between relative z-10">
            <span className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-widest">
              Cleared & Ready Today
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-3 relative z-10">
            <span className="text-2xl font-black text-emerald-700">
              £{totalClearedFunds.toFixed(2)}
            </span>
            <span className="text-[11px] font-bold text-emerald-600/80 block mt-0.5">
              Available for immediate Friday cashout
            </span>
          </div>
        </div>

        {/* Total Upcoming Pending Payouts */}
        <div className="bg-white border border-blue-200 rounded-xl p-4 shadow-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-full blur-xl -mr-6 -mt-6 pointer-events-none" />
          <div className="flex items-center justify-between relative z-10">
            <span className="text-[10px] font-extrabold text-blue-700 uppercase tracking-widest">
              Upcoming Pending Payouts
            </span>
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-3 relative z-10">
            <span className="text-2xl font-black text-blue-700">
              £{totalPendingPayouts.toFixed(2)}
            </span>
            <span className="text-[11px] font-bold text-blue-600/80 block mt-0.5">
              Maturing across future Friday dates
            </span>
          </div>
        </div>

        {/* Pending Cashout Requests */}
        <div className="bg-white border border-amber-200 rounded-xl p-4 shadow-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50 rounded-full blur-xl -mr-6 -mt-6 pointer-events-none" />
          <div className="flex items-center justify-between relative z-10">
            <span className="text-[10px] font-extrabold text-amber-700 uppercase tracking-widest">
              Pending Cashouts Claimed
            </span>
            <Coins className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-3 relative z-10">
            <span className="text-2xl font-black text-amber-700">
              £{totalPendingCashoutsAmt.toFixed(2)}
            </span>
            <span className="text-[11px] font-bold text-amber-600/80 block mt-0.5">
              Awaiting admin approval/transfer
            </span>
          </div>
        </div>

        {/* Total Outstanding Combined */}
        <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between relative z-10">
            <span className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-widest">
              Total Unsettled Stall Earnings
            </span>
            <TrendingUp className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="mt-3 relative z-10">
            <span className="text-2xl font-black text-zinc-900">
              £{totalOutstandingBalance.toFixed(2)}
            </span>
            <span className="text-[11px] font-bold text-zinc-400 block mt-0.5">
              Combined cleared + pending funds
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
                        <p className="text-[11px] text-zinc-500 font-semibold mt-0.5">
                          {group.sales.length} card {group.sales.length === 1 ? 'sale' : 'sales'} maturing for {vendorList.length} {vendorList.length === 1 ? 'vendor' : 'vendors'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4">
                      <div className="text-right">
                        <span className="text-xs font-extrabold text-zinc-400 block uppercase tracking-widest">
                          Payout Total Due
                        </span>
                        <span className={`text-lg font-black ${group.isMature ? 'text-emerald-700' : 'text-zinc-900'}`}>
                          £{group.totalEarnings.toFixed(2)}
                        </span>
                      </div>

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
                      Vendor Breakdown:
                    </span>
                    {vendorList.map(({ vendor, earnings, count }) => (
                      <div
                        key={vendor.id}
                        className="inline-flex items-center gap-1.5 bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-1 text-xs font-bold text-zinc-800"
                      >
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: vendor.color || '#3B82F6' }}
                        />
                        <span>{vendor.name}:</span>
                        <span className="text-blue-600 font-extrabold">£{earnings.toFixed(2)}</span>
                        <span className="text-[10px] font-normal text-zinc-400">({count})</span>
                      </div>
                    ))}
                  </div>

                  {/* Expanded Itemized Sales List */}
                  {isExpanded && (
                    <div className="border-t border-zinc-200 bg-zinc-50/50 p-4 animate-in fade-in duration-150">
                      <h5 className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest mb-3">
                        Itemized Transactions Maturing On This Date
                      </h5>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-zinc-200 text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider">
                              <th className="pb-2 pr-3">Vendor / Stall</th>
                              <th className="pb-2 pr-3">Item Description</th>
                              <th className="pb-2 pr-3 text-right">Sale Price</th>
                              <th className="pb-2 pr-3 text-right">Vendor Net</th>
                              <th className="pb-2 text-right">Date Sold</th>
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
                                  <td className="py-2.5 text-right text-zinc-400 text-[11px]">
                                    {new Date(sale.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
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
          <div className="p-4 bg-zinc-50/80 border-b border-zinc-200 flex justify-between items-center">
            <div>
              <h3 className="text-xs font-black text-zinc-900 uppercase tracking-wider">
                Vendor Stall Payout Summary
              </h3>
              <p className="text-[11px] text-zinc-500 font-medium">
                Comprehensive balance sheet showing cleared funds, upcoming pending payouts, and net totals per vendor.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-zinc-100/70 border-b border-zinc-200 text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest">
                  <th className="py-3 px-4">Stall / Vendor</th>
                  <th className="py-3 px-4 text-right">Cleared Today (£)</th>
                  <th className="py-3 px-4 text-right">Pending Upcoming (£)</th>
                  <th className="py-3 px-4 text-right">Trade-In Deductions</th>
                  <th className="py-3 px-4 text-right">Pending Cashouts</th>
                  <th className="py-3 px-4 text-right">Net Consolidated Total</th>
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

                      {/* Cleared Today */}
                      <td className="py-3 px-4 text-right">
                        <span className={`font-black ${summary.availableCash > 0 ? 'text-emerald-600' : 'text-zinc-400'}`}>
                          £{summary.availableCash.toFixed(2)}
                        </span>
                      </td>

                      {/* Pending Upcoming */}
                      <td className="py-3 px-4 text-right">
                        <span className={`font-black ${summary.pendingCash > 0 ? 'text-blue-600' : 'text-zinc-400'}`}>
                          £{summary.pendingCash.toFixed(2)}
                        </span>
                      </td>

                      {/* Trade-In Deductions */}
                      <td className="py-3 px-4 text-right">
                        {summary.spentOnTradeIns > 0 ? (
                          <span className="font-extrabold text-red-600 bg-red-50 px-2 py-0.5 rounded text-[11px]">
                            -£{summary.spentOnTradeIns.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-zinc-400 text-xs">—</span>
                        )}
                      </td>

                      {/* Pending Cashouts */}
                      <td className="py-3 px-4 text-right">
                        {summary.pendingCashoutsAmount > 0 ? (
                          <span className="font-extrabold text-amber-600 bg-amber-50 px-2 py-0.5 rounded text-[11px]">
                            £{summary.pendingCashoutsAmount.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-zinc-400 text-xs">—</span>
                        )}
                      </td>

                      {/* Consolidated Total */}
                      <td className="py-3 px-4 text-right">
                        <span className="font-black text-zinc-900 text-sm">
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
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
