import React, { useState } from 'react';
import { 
  ArrowLeftRight, 
  Search, 
  Filter, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Plus, 
  Coins, 
  Store, 
  RefreshCw, 
  Sparkles,
  TrendingUp,
  FileText,
  AlertCircle
} from 'lucide-react';
import { Vendor, TradeIn } from '../types';

interface StaffTradeInsTabProps {
  vendors: Vendor[];
  tradeIns: TradeIn[];
  onAddTradeIn?: (tradeInData: {
    vendorId: string;
    details: string;
    estimatedValue: number;
    creditApplied: number;
  }) => Promise<void>;
  onViewVendorProfile?: (vendorId: string) => void;
}

export default function StaffTradeInsTab({
  vendors,
  tradeIns,
  onAddTradeIn,
  onViewVendorProfile
}: StaffTradeInsTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVendorFilter, setSelectedVendorFilter] = useState('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('ALL');
  const [isAddingTradeIn, setIsAddingTradeIn] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state for standalone trade-in
  const [vendorId, setVendorId] = useState('');
  const [details, setDetails] = useState('');
  const [estimatedValue, setEstimatedValue] = useState('');
  const [creditApplied, setCreditApplied] = useState('');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

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

  // Sort trade-ins newest first
  const sortedTradeIns = [...tradeIns].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // Filter trade-ins
  const filteredTradeIns = sortedTradeIns.filter((t) => {
    if (selectedVendorFilter !== 'ALL' && t.vendorId !== selectedVendorFilter) {
      return false;
    }
    if (selectedStatusFilter !== 'ALL' && t.status !== selectedStatusFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const vendorName = vendors.find((v) => v.id === t.vendorId)?.name.toLowerCase() || t.vendorName.toLowerCase();
      const itemDetails = t.details.toLowerCase();
      return itemDetails.includes(q) || vendorName.includes(q) || t.id.toLowerCase().includes(q);
    }
    return true;
  });

  // Calculate Metrics
  const totalCount = tradeIns.length;
  const totalValueTraded = tradeIns.reduce((acc, t) => acc + (t.estimatedValue || 0), 0);
  const totalCreditApplied = tradeIns.reduce((acc, t) => acc + (t.creditApplied || 0), 0);

  const todayStr = new Date().toISOString().slice(0, 10);
  const countToday = tradeIns.filter((t) => t.date && t.date.slice(0, 10) === todayStr).length;

  const handleCreateTradeIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!vendorId) {
      setFormError('Please select a vendor / stall.');
      return;
    }
    if (!details.trim()) {
      setFormError('Please enter trade-in details or item description.');
      return;
    }
    const valNum = Number(estimatedValue);
    if (isNaN(valNum) || valNum <= 0) {
      setFormError('Please enter a valid estimated trade-in value.');
      return;
    }

    const credNum = creditApplied ? Number(creditApplied) : valNum;

    try {
      setIsSubmitting(true);
      if (onAddTradeIn) {
        await onAddTradeIn({
          vendorId,
          details: details.trim(),
          estimatedValue: valNum,
          creditApplied: credNum
        });
      }
      setFormSuccess('Trade-in successfully recorded in real time!');
      setDetails('');
      setEstimatedValue('');
      setCreditApplied('');
      setVendorId('');
      setIsAddingTradeIn(false);
      setTimeout(() => setFormSuccess(''), 4000);
    } catch (err: any) {
      setFormError(err.message || 'Failed to submit trade-in.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner with Real-Time Indicator */}
      <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-xs">
              <ArrowLeftRight className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-zinc-900 uppercase tracking-wider">
                  Real-Time Trade-Ins Feed
                </h2>
                <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1.5 uppercase tracking-wider shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Live Sync
                </span>
              </div>
              <p className="text-xs text-zinc-500 font-medium mt-0.5">
                All trade-ins logged across Newton's Collectables register terminals and vendor accounts in real time.
              </p>
            </div>
          </div>

          {/* Quick Action Button */}
          {onAddTradeIn && (
            <button
              type="button"
              id="btn-open-log-tradein"
              onClick={() => setIsAddingTradeIn(!isAddingTradeIn)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-lg transition-all shadow-xs cursor-pointer self-start md:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>{isAddingTradeIn ? 'Close Quick Log' : 'Log Standalone Trade-In'}</span>
            </button>
          )}
        </div>

        {formSuccess && (
          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{formSuccess}</span>
          </div>
        )}
      </div>

      {/* Standalone Trade-In Logging Form Modal/Card */}
      {isAddingTradeIn && (
        <form
          onSubmit={handleCreateTradeIn}
          className="bg-white border-2 border-blue-200 rounded-xl p-5 shadow-md space-y-4 animate-in fade-in duration-150"
        >
          <div className="flex justify-between items-center border-b border-zinc-100 pb-3">
            <h3 className="text-xs font-black text-zinc-900 uppercase tracking-wider flex items-center gap-2">
              <Plus className="w-4 h-4 text-blue-600" />
              Log New Standalone Trade-In
            </h3>
            <span className="text-[10px] font-bold text-zinc-400">
              Updates vendor account balance & trade-in logs live
            </span>
          </div>

          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider mb-1">
                Vendor / Stall <span className="text-red-500">*</span>
              </label>
              <select
                id="select-tradein-vendor"
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-200 focus:bg-white text-xs font-bold rounded-lg py-2 px-3 outline-none text-zinc-800"
                required
              >
                <option value="">Select Vendor...</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {getVendorColorEmoji(v.color)} {v.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider mb-1">
                Traded-In Items / Description <span className="text-red-500">*</span>
              </label>
              <input
                id="input-tradein-details"
                type="text"
                placeholder="e.g. 3x Pokemon Charizard VMAX cards"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-200 focus:bg-white text-xs font-medium rounded-lg py-2 px-3 outline-none text-zinc-800"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider mb-1">
                Value Traded (£) <span className="text-red-500">*</span>
              </label>
              <input
                id="input-tradein-val"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={estimatedValue}
                onChange={(e) => {
                  setEstimatedValue(e.target.value);
                  if (!creditApplied) setCreditApplied(e.target.value);
                }}
                className="w-full bg-zinc-50 border border-zinc-200 focus:bg-white text-xs font-black text-blue-600 rounded-lg py-2 px-3 outline-none"
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
            <button
              type="button"
              onClick={() => setIsAddingTradeIn(false)}
              className="px-3 py-1.5 text-xs font-bold text-zinc-500 hover:text-zinc-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-lg shadow-xs transition-all disabled:opacity-50"
            >
              {isSubmitting ? 'Logging Trade-In...' : 'Confirm & Log Trade-In'}
            </button>
          </div>
        </form>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Trade-Ins Logged */}
        <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-widest">
              Total Trade-Ins
            </span>
            <ArrowLeftRight className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-zinc-900">{totalCount}</span>
            <span className="text-[11px] font-bold text-zinc-400 block mt-0.5">
              Across all register sessions
            </span>
          </div>
        </div>

        {/* Traded Today */}
        <div className="bg-white border border-emerald-200 rounded-xl p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-widest">
              Traded Today
            </span>
            <Clock className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-emerald-700">{countToday}</span>
            <span className="text-[11px] font-bold text-emerald-600/80 block mt-0.5">
              Logged today ({new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })})
            </span>
          </div>
        </div>

        {/* Total Estimated Value Traded */}
        <div className="bg-white border border-blue-200 rounded-xl p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-blue-700 uppercase tracking-widest">
              Total Value Traded In
            </span>
            <Coins className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-blue-700">
              £{totalValueTraded.toFixed(2)}
            </span>
            <span className="text-[11px] font-bold text-blue-600/80 block mt-0.5">
              Gross estimated value
            </span>
          </div>
        </div>

        {/* Net Deductions / Credit Applied */}
        <div className="bg-white border border-purple-200 rounded-xl p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-purple-700 uppercase tracking-widest">
              Total Credit / Deductions
            </span>
            <TrendingUp className="w-4 h-4 text-purple-600" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-purple-700">
              £{Math.abs(totalCreditApplied).toFixed(2)}
            </span>
            <span className="text-[11px] font-bold text-purple-600/80 block mt-0.5">
              Deducted from vendor accounts
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-zinc-400 shrink-0" />
            <span className="text-xs font-extrabold text-zinc-600 uppercase tracking-wider whitespace-nowrap">
              Stall:
            </span>
            <select
              id="filter-tradein-vendor"
              value={selectedVendorFilter}
              onChange={(e) => setSelectedVendorFilter(e.target.value)}
              className="bg-zinc-50 border border-zinc-200 hover:border-zinc-300 text-xs font-bold rounded-lg py-2 px-3 outline-none text-zinc-700 cursor-pointer"
            >
              <option value="ALL">All Stalls ({vendors.length})</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {getVendorColorEmoji(v.color)} {v.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-extrabold text-zinc-600 uppercase tracking-wider whitespace-nowrap">
              Status:
            </span>
            <select
              id="filter-tradein-status"
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="bg-zinc-50 border border-zinc-200 hover:border-zinc-300 text-xs font-bold rounded-lg py-2 px-3 outline-none text-zinc-700 cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="approved">Approved / Applied</option>
              <option value="pending">Pending Review</option>
              <option value="declined">Declined</option>
            </select>
          </div>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            id="search-tradeins"
            type="text"
            placeholder="Search items, vendor, or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-50 border border-zinc-200 focus:bg-white focus:ring-2 focus:ring-blue-100 text-xs rounded-lg py-2 pl-9 pr-3 outline-none font-semibold text-zinc-700 transition-all"
          />
        </div>
      </div>

      {/* Real-Time Table */}
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-xs">
        <div className="p-4 bg-zinc-50/80 border-b border-zinc-200 flex justify-between items-center">
          <div>
            <h3 className="text-xs font-black text-zinc-900 uppercase tracking-wider flex items-center gap-2">
              <span>Trade-Ins Log</span>
              <span className="bg-blue-100 text-blue-800 text-[10px] font-black px-2 py-0.5 rounded">
                {filteredTradeIns.length} Records
              </span>
            </h3>
          </div>
          <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Live Updates Enabled
          </span>
        </div>

        {filteredTradeIns.length === 0 ? (
          <div className="p-12 text-center">
            <ArrowLeftRight className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
            <h4 className="text-sm font-bold text-zinc-800">No Trade-Ins Found</h4>
            <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
              No trade-in records match your current filter and search settings.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-zinc-100/70 border-b border-zinc-200 text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest">
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Stall / Vendor</th>
                  <th className="py-3 px-4">Item Details / Description</th>
                  <th className="py-3 px-4 text-right">Traded Value</th>
                  <th className="py-3 px-4 text-right">Credit / Deduction</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 font-semibold text-zinc-800">
                {filteredTradeIns.map((tradeIn) => {
                  const vendor = vendors.find((v) => v.id === tradeIn.vendorId);
                  const isRegisterTradeIn = tradeIn.details.startsWith('[Register Trade-In]');
                  const cleanDetails = isRegisterTradeIn 
                    ? tradeIn.details.replace('[Register Trade-In]', '').trim() 
                    : tradeIn.details;

                  const formattedDate = new Date(tradeIn.date).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  });

                  return (
                    <tr key={tradeIn.id} className="hover:bg-zinc-50/80 transition-colors">
                      {/* Date */}
                      <td className="py-3 px-4 whitespace-nowrap text-zinc-500 text-[11px]">
                        {formattedDate}
                      </td>

                      {/* Stall / Vendor */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full shrink-0 shadow-2xs"
                            style={{ backgroundColor: vendor?.color || '#3B82F6' }}
                          />
                          <button
                            type="button"
                            onClick={() => onViewVendorProfile && onViewVendorProfile(tradeIn.vendorId)}
                            className="font-extrabold text-zinc-900 text-xs hover:text-blue-600 transition-colors text-left"
                          >
                            {vendor?.name || tradeIn.vendorName || 'Unknown Stall'}
                          </button>
                        </div>
                      </td>

                      {/* Details */}
                      <td className="py-3 px-4 max-w-xs md:max-w-md">
                        <div className="space-y-0.5">
                          <span className="font-bold text-zinc-900 block leading-tight">
                            {cleanDetails}
                          </span>
                          {isRegisterTradeIn && (
                            <span className="inline-block bg-blue-50 text-blue-700 text-[9px] font-black px-1.5 py-0.2 rounded border border-blue-100 uppercase tracking-wider">
                              Register Logged
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Estimated Value */}
                      <td className="py-3 px-4 text-right">
                        <span className="font-extrabold text-zinc-900">
                          £{(tradeIn.estimatedValue || 0).toFixed(2)}
                        </span>
                      </td>

                      {/* Credit Applied / Deducted */}
                      <td className="py-3 px-4 text-right">
                        <span className="font-black text-purple-700">
                          £{Math.abs(tradeIn.creditApplied || 0).toFixed(2)}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center">
                        {tradeIn.status === 'approved' && (
                          <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Applied
                          </span>
                        )}
                        {tradeIn.status === 'pending' && (
                          <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                            <Clock className="w-3 h-3 text-amber-600" />
                            Pending
                          </span>
                        )}
                        {tradeIn.status === 'declined' && (
                          <span className="inline-flex items-center gap-1 bg-red-100 text-red-800 border border-red-200 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                            <XCircle className="w-3 h-3 text-red-600" />
                            Declined
                          </span>
                        )}
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
