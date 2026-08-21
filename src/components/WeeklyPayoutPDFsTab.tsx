import React, { useState, useMemo } from 'react';
import { 
  FileText, 
  Download, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  Search, 
  ChevronDown, 
  ChevronUp, 
  Users, 
  Check,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { Vendor, Sale, CashoutRequest, TradeIn } from '../types';
import { getPayoutDate, isSaleMature, getRemainingDays, getWeekOfYear } from '../payoutUtils';
import { downloadStandaloneWeeklyVendorPayoutPDF } from '../pdfUtils';

interface WeeklyPayoutPDFsTabProps {
  vendors: Vendor[];
  sales: Sale[];
  cashouts?: CashoutRequest[];
  tradeIns?: TradeIn[];
  onViewVendorProfile?: (vendorId: string) => void;
}

interface VendorWeeklyData {
  vendor: Vendor;
  sales: Sale[];
  grossSales: number;
  commissionTotal: number;
  netPayoutDue: number;
  itemCount: number;
}

interface WeeklyPayoutGroup {
  dateKey: string;            // YYYY-MM-DD
  payoutDate: Date;
  formattedDate: string;      // e.g. "Friday, 22 Aug 2026"
  weekNumber: number;
  isMature: boolean;
  remainingDays: number;
  sales: Sale[];
  totalGross: number;
  totalCommission: number;
  totalNetPayout: number;
  vendorDataMap: Record<string, VendorWeeklyData>;
  activeVendors: VendorWeeklyData[];
}

export function WeeklyPayoutPDFsTab({
  vendors,
  sales,
  cashouts = [],
  tradeIns = [],
  onViewVendorProfile
}: WeeklyPayoutPDFsTabProps) {
  const now = useMemo(() => new Date(), []);

  // Compute all weekly payout groups from all recorded sales
  const weeklyGroups = useMemo<WeeklyPayoutGroup[]>(() => {
    const groups: Record<string, WeeklyPayoutGroup> = {};

    sales.forEach((sale) => {
      // Ignore sales that have been cashed out already if needed, or include for statement audit
      const payoutDate = getPayoutDate(sale.date);
      const year = payoutDate.getFullYear();
      const month = String(payoutDate.getMonth() + 1).padStart(2, '0');
      const day = String(payoutDate.getDate()).padStart(2, '0');
      const dateKey = `${year}-${month}-${day}`;
      const weekNumber = getWeekOfYear(payoutDate);

      if (!groups[dateKey]) {
        const formattedDate = payoutDate.toLocaleDateString('en-GB', {
          weekday: 'long',
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        });
        const isMature = isSaleMature(sale.date, now);
        const remainingDays = getRemainingDays(sale.date, now);

        // Initialize vendor map with empty entries for all vendors
        const vendorDataMap: Record<string, VendorWeeklyData> = {};
        vendors.forEach((v) => {
          vendorDataMap[v.id] = {
            vendor: v,
            sales: [],
            grossSales: 0,
            commissionTotal: 0,
            netPayoutDue: 0,
            itemCount: 0
          };
        });

        groups[dateKey] = {
          dateKey,
          payoutDate,
          formattedDate,
          weekNumber,
          isMature,
          remainingDays,
          sales: [],
          totalGross: 0,
          totalCommission: 0,
          totalNetPayout: 0,
          vendorDataMap,
          activeVendors: []
        };
      }

      const group = groups[dateKey];
      group.sales.push(sale);
      group.totalGross += sale.price;
      group.totalCommission += sale.commissionAmount;
      group.totalNetPayout += sale.vendorEarnings;

      if (!group.vendorDataMap[sale.vendorId]) {
        const vendorObj = vendors.find((v) => v.id === sale.vendorId) || {
          id: sale.vendorId,
          name: sale.vendorName || 'Unknown Vendor',
          pin: '0000',
          commission: 0.1,
          tradeCredit: 0
        };
        group.vendorDataMap[sale.vendorId] = {
          vendor: vendorObj,
          sales: [],
          grossSales: 0,
          commissionTotal: 0,
          netPayoutDue: 0,
          itemCount: 0
        };
      }

      const vData = group.vendorDataMap[sale.vendorId];
      vData.sales.push(sale);
      vData.grossSales += sale.price;
      vData.commissionTotal += sale.commissionAmount;
      vData.netPayoutDue += sale.vendorEarnings;
      vData.itemCount += 1;
    });

    // Populate activeVendors array for each group
    Object.values(groups).forEach((g) => {
      g.activeVendors = Object.values(g.vendorDataMap).filter((v) => v.sales.length > 0);
    });

    // Sort chronologically by payout date
    return Object.values(groups).sort((a, b) => a.payoutDate.getTime() - b.payoutDate.getTime());
  }, [sales, vendors, now]);

  // Determine default selected date (the current week's Friday or nearest upcoming)
  const defaultDateKey = useMemo(() => {
    if (weeklyGroups.length === 0) return '';
    // Find first mature or closest upcoming
    const today = new Date();
    const upcoming = weeklyGroups.find((g) => g.payoutDate >= today);
    return upcoming ? upcoming.dateKey : weeklyGroups[weeklyGroups.length - 1].dateKey;
  }, [weeklyGroups]);

  const [selectedDateKey, setSelectedDateKey] = useState<string>(defaultDateKey);

  // If selectedDateKey is empty but groups become available, update it
  React.useEffect(() => {
    if (!selectedDateKey && weeklyGroups.length > 0) {
      setSelectedDateKey(defaultDateKey);
    }
  }, [selectedDateKey, weeklyGroups, defaultDateKey]);

  const activeGroup = useMemo(() => {
    return weeklyGroups.find((g) => g.dateKey === selectedDateKey) || weeklyGroups[0] || null;
  }, [weeklyGroups, selectedDateKey]);

  // Search & Filter state inside the active week
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedVendorIds, setExpandedVendorIds] = useState<Record<string, boolean>>({});
  const [isDownloadingBatch, setIsDownloadingBatch] = useState(false);
  const [batchProgress, setBatchProgress] = useState<string | null>(null);

  const toggleExpandVendor = (vId: string) => {
    setExpandedVendorIds((prev) => ({
      ...prev,
      [vId]: !prev[vId]
    }));
  };

  // Filtered vendor list for the active week
  const filteredVendorList = useMemo(() => {
    if (!activeGroup) return [];
    const query = searchQuery.trim().toLowerCase();

    return activeGroup.activeVendors.filter((vData) => {
      if (!query) return true;
      const vendorNameMatch = vData.vendor.name.toLowerCase().includes(query);
      const itemMatch = vData.sales.some((s) => s.itemName.toLowerCase().includes(query));
      return vendorNameMatch || itemMatch;
    });
  }, [activeGroup, searchQuery]);

  // Handler to download standalone weekly PDF for a single vendor
  const handleDownloadSingleVendorWeeklyPDF = async (vData: VendorWeeklyData) => {
    if (!activeGroup) return;
    await downloadStandaloneWeeklyVendorPayoutPDF({
      vendor: vData.vendor,
      weekNumber: activeGroup.weekNumber,
      payoutDate: activeGroup.payoutDate,
      formattedPayoutDate: activeGroup.formattedDate,
      sales: vData.sales,
      now
    });
  };

  // Handler to batch download standalone weekly PDFs for all active vendors in this week
  const handleDownloadAllWeeklyPDFs = async () => {
    if (!activeGroup || activeGroup.activeVendors.length === 0) return;
    setIsDownloadingBatch(true);
    const vendorsToDownload = activeGroup.activeVendors;

    for (let i = 0; i < vendorsToDownload.length; i++) {
      const vData = vendorsToDownload[i];
      setBatchProgress(`Generating PDF ${i + 1} of ${vendorsToDownload.length}: ${vData.vendor.name}...`);
      await downloadStandaloneWeeklyVendorPayoutPDF({
        vendor: vData.vendor,
        weekNumber: activeGroup.weekNumber,
        payoutDate: activeGroup.payoutDate,
        formattedPayoutDate: activeGroup.formattedDate,
        sales: vData.sales,
        now
      });
      // Short delay between triggers to ensure clean separate downloads in the browser
      await new Promise((resolve) => setTimeout(resolve, 350));
    }

    setBatchProgress(`All ${vendorsToDownload.length} Week ${activeGroup.weekNumber} PDFs downloaded successfully!`);
    setTimeout(() => {
      setIsDownloadingBatch(false);
      setBatchProgress(null);
    }, 2500);
  };

  if (weeklyGroups.length === 0) {
    return (
      <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center shadow-xs">
        <FileText className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
        <h4 className="text-base font-extrabold text-zinc-800">No Weekly Payout Statements Available</h4>
        <p className="text-xs text-zinc-500 mt-1 max-w-md mx-auto">
          As soon as card transactions are recorded in the Joint Register, weekly standalone payout statements will automatically generate here for every Friday payout date.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-zinc-900 text-white text-[10px] font-black px-2.5 py-0.5 rounded uppercase tracking-wider">
                WEEKLY STATEMENTS
              </span>
              <span className="text-xs font-bold text-zinc-500">
                Standalone Weekly Version (Isolated by Week)
              </span>
            </div>
            <h3 className="text-lg font-black text-zinc-900 mt-1 flex items-center gap-2">
              <FileText className="w-5 h-5 text-amber-500" />
              Weekly Payout PDF Statements
            </h3>
            <p className="text-xs text-zinc-500 font-medium mt-0.5">
              Download individual or batch weekly payout PDFs for each vendor. These statements contain strictly that week's card sales and payout receipt.
            </p>
          </div>

          {activeGroup && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                id="btn-download-all-weekly-pdfs"
                type="button"
                onClick={handleDownloadAllWeeklyPDFs}
                disabled={isDownloadingBatch || activeGroup.activeVendors.length === 0}
                className="px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-400 text-white text-xs font-black rounded-lg transition-all shadow-xs flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <Download className="w-4 h-4 text-amber-400" />
                <span>Download All Week {activeGroup.weekNumber} PDFs ({activeGroup.activeVendors.length})</span>
              </button>
            </div>
          )}
        </div>

        {/* Batch download progress notification */}
        {batchProgress && (
          <div className="mt-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-lg p-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{batchProgress}</span>
          </div>
        )}
      </div>

      {/* Week Selector Bar */}
      <div className="bg-zinc-100/80 p-1.5 rounded-xl border border-zinc-200 flex items-center gap-1.5 overflow-x-auto">
        {weeklyGroups.map((group) => {
          const isSelected = group.dateKey === selectedDateKey;
          return (
            <button
              key={group.dateKey}
              id={`btn-select-week-${group.weekNumber}-${group.dateKey}`}
              type="button"
              onClick={() => setSelectedDateKey(group.dateKey)}
              className={`px-3.5 py-2 rounded-lg text-xs font-extrabold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
                isSelected
                  ? 'bg-zinc-900 text-white shadow-xs'
                  : 'bg-white text-zinc-700 hover:bg-zinc-200/80 border border-zinc-200/60'
              }`}
            >
              <Calendar className={`w-3.5 h-3.5 ${isSelected ? 'text-amber-400' : 'text-zinc-400'}`} />
              <span>Week {group.weekNumber}</span>
              <span className={`text-[10px] font-semibold ${isSelected ? 'text-zinc-300' : 'text-zinc-500'}`}>
                ({group.payoutDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })})
              </span>
              {group.isMature ? (
                <span className={`text-[9px] px-1.5 py-0.2 rounded font-black ${
                  isSelected ? 'bg-emerald-500/30 text-emerald-300' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  CLEARED
                </span>
              ) : (
                <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                  isSelected ? 'bg-blue-500/30 text-blue-200' : 'bg-blue-50 text-blue-700'
                }`}>
                  {group.remainingDays}d
                </span>
              )}
            </button>
          );
        })}
      </div>

      {activeGroup && (
        <>
          {/* Week Overview KPI Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-zinc-200 p-4 shadow-xs">
              <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest block">
                Target Payout Date
              </span>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-base font-black text-zinc-900">
                  Week {activeGroup.weekNumber}
                </span>
                {activeGroup.isMature ? (
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded uppercase">
                    Ready Today
                  </span>
                ) : (
                  <span className="bg-blue-100 text-blue-800 text-[10px] font-black px-2 py-0.5 rounded uppercase">
                    In {activeGroup.remainingDays} Days
                  </span>
                )}
              </div>
              <span className="text-[11px] font-semibold text-zinc-500 block mt-1">
                {activeGroup.formattedDate}
              </span>
            </div>

            <div className="bg-white rounded-xl border border-zinc-200 p-4 shadow-xs">
              <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest block">
                Total Net Payout Due
              </span>
              <span className="text-xl font-black text-emerald-600 tracking-tight block mt-1">
                £{activeGroup.totalNetPayout.toFixed(2)}
              </span>
              <span className="text-[11px] font-semibold text-zinc-500 block mt-1">
                Across {activeGroup.activeVendors.length} stall vendor{activeGroup.activeVendors.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="bg-white rounded-xl border border-zinc-200 p-4 shadow-xs">
              <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest block">
                Week Gross Card Sales
              </span>
              <span className="text-xl font-black text-zinc-900 tracking-tight block mt-1">
                £{activeGroup.totalGross.toFixed(2)}
              </span>
              <span className="text-[11px] font-semibold text-zinc-500 block mt-1">
                {activeGroup.sales.length} item transactions logged
              </span>
            </div>

            <div className="bg-white rounded-xl border border-zinc-200 p-4 shadow-xs">
              <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest block">
                Newton Space Commission
              </span>
              <span className="text-xl font-black text-blue-600 tracking-tight block mt-1">
                £{activeGroup.totalCommission.toFixed(2)}
              </span>
              <span className="text-[11px] font-semibold text-zinc-500 block mt-1">
                Deducted automatically
              </span>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-zinc-200 p-3 rounded-xl shadow-xs">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="input-search-weekly-vendor-pdfs"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search vendor name or card/item title..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-800 font-semibold focus:outline-none focus:ring-2 focus:ring-zinc-400"
              />
            </div>

            <div className="flex items-center gap-2 text-xs font-bold text-zinc-500">
              <Users className="w-4 h-4 text-zinc-400" />
              <span>
                Showing {filteredVendorList.length} of {activeGroup.activeVendors.length} active stall statements
              </span>
            </div>
          </div>

          {/* List of Weekly PDFs by Vendor */}
          {filteredVendorList.length === 0 ? (
            <div className="bg-white border border-zinc-200 rounded-xl p-8 text-center shadow-xs">
              <AlertCircle className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
              <p className="text-xs font-bold text-zinc-600">No vendor statements match your filter.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredVendorList.map((vData) => {
                const isExpanded = !!expandedVendorIds[vData.vendor.id];

                return (
                  <div
                    key={vData.vendor.id}
                    className="bg-white rounded-xl border border-zinc-200 shadow-xs overflow-hidden transition-all"
                  >
                    {/* Vendor Summary Card Header */}
                    <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-50/50 hover:bg-zinc-50 transition-colors">
                      <div className="flex items-start sm:items-center gap-3">
                        <div
                          className="w-4 h-4 rounded-full shrink-0 mt-0.5 sm:mt-0 border border-black/10 shadow-2xs"
                          style={{ backgroundColor: vData.vendor.color || '#64748B' }}
                        />
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-sm font-black text-zinc-900">
                              {vData.vendor.name}
                            </h4>
                            <span className="text-[10px] font-bold text-zinc-500 bg-zinc-100 border border-zinc-200 px-2 py-0.5 rounded">
                              {(vData.vendor.commission * 100).toFixed(1)}% Comm.
                            </span>
                            <span className="text-[10px] font-bold text-zinc-400">
                              ID: {vData.vendor.id}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 mt-1 text-xs font-semibold text-zinc-500">
                            <span>{vData.itemCount} card sale{vData.itemCount === 1 ? '' : 's'}</span>
                            <span>•</span>
                            <span>Gross: <strong>£{vData.grossSales.toFixed(2)}</strong></span>
                            <span>•</span>
                            <span>Comm: <strong className="text-blue-600">-£{vData.commissionTotal.toFixed(2)}</strong></span>
                          </div>
                        </div>
                      </div>

                      {/* Right side: Net Payout Amount + Actions */}
                      <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-3 sm:pt-0 border-zinc-100">
                        <div className="text-left sm:text-right">
                          <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest block">
                            Net Payout Due
                          </span>
                          <span className="text-base sm:text-lg font-black text-emerald-600">
                            £{vData.netPayoutDue.toFixed(2)}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            id={`btn-download-weekly-pdf-${vData.vendor.id}`}
                            type="button"
                            onClick={() => handleDownloadSingleVendorWeeklyPDF(vData)}
                            className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 active:bg-black text-white text-xs font-bold rounded-lg transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                            title={`Download Week ${activeGroup.weekNumber} Standalone PDF Statement for ${vData.vendor.name}`}
                          >
                            <Download className="w-3.5 h-3.5 text-amber-400" />
                            <span>Download Week {activeGroup.weekNumber} PDF</span>
                          </button>

                          {onViewVendorProfile && (
                            <button
                              type="button"
                              onClick={() => onViewVendorProfile(vData.vendor.id)}
                              className="p-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 rounded-lg transition-colors cursor-pointer"
                              title="View Vendor Profile"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => toggleExpandVendor(vData.vendor.id)}
                            className="p-2 text-zinc-400 hover:text-zinc-700 bg-white border border-zinc-200 rounded-lg transition-colors cursor-pointer"
                            title={isExpanded ? "Collapse itemized transactions" : "Expand itemized transactions"}
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Expandable Itemized Transactions in this Weekly Statement */}
                    {isExpanded && (
                      <div className="border-t border-zinc-200 bg-white p-4">
                        <div className="text-[11px] font-extrabold text-zinc-500 uppercase tracking-wider mb-2 flex items-center justify-between">
                          <span>Itemized Transactions Included in Statement (Week {activeGroup.weekNumber})</span>
                          <span>{vData.sales.length} record{vData.sales.length === 1 ? '' : 's'}</span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="border-b border-zinc-200 bg-zinc-50 text-[10px] font-extrabold text-zinc-600 uppercase tracking-wider">
                                <th className="py-2.5 px-3">Date & Time</th>
                                <th className="py-2.5 px-3">Card / Item Name</th>
                                <th className="py-2.5 px-3 text-right">Gross Price</th>
                                <th className="py-2.5 px-3 text-right">Commission ({(vData.vendor.commission * 100).toFixed(1)}%)</th>
                                <th className="py-2.5 px-3 text-right">Net Payout</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 font-medium">
                              {vData.sales.map((sale) => (
                                <tr key={sale.id} className="hover:bg-zinc-50/60 transition-colors">
                                  <td className="py-2 px-3 font-mono text-zinc-500 whitespace-nowrap">
                                    {new Date(sale.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} • {new Date(sale.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                  </td>
                                  <td className="py-2 px-3 font-bold text-zinc-900">
                                    {sale.itemName}
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono text-zinc-800">
                                    £{sale.price.toFixed(2)}
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono text-rose-600">
                                    -£{sale.commissionAmount.toFixed(2)}
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono font-bold text-emerald-600">
                                    £{sale.vendorEarnings.toFixed(2)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="bg-zinc-900 text-white font-bold text-xs">
                                <td className="py-2 px-3" colSpan={2}>
                                  TOTAL FOR WEEK {activeGroup.weekNumber} STATEMENT
                                </td>
                                <td className="py-2 px-3 text-right font-mono">
                                  £{vData.grossSales.toFixed(2)}
                                </td>
                                <td className="py-2 px-3 text-right font-mono text-rose-300">
                                  -£{vData.commissionTotal.toFixed(2)}
                                </td>
                                <td className="py-2 px-3 text-right font-mono text-emerald-300 font-black">
                                  £{vData.netPayoutDue.toFixed(2)}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Inactive Stall Vendors (0 sales in this week) */}
          {vendors.filter((v) => !activeGroup.vendorDataMap[v.id] || activeGroup.vendorDataMap[v.id].sales.length === 0).length > 0 && (
            <div className="bg-zinc-50 border border-zinc-200/80 rounded-xl p-4">
              <span className="text-[11px] font-bold text-zinc-500 block mb-2">
                Stall Vendors with No Card Sales in Week {activeGroup.weekNumber}:
              </span>
              <div className="flex flex-wrap gap-2">
                {vendors
                  .filter((v) => !activeGroup.vendorDataMap[v.id] || activeGroup.vendorDataMap[v.id].sales.length === 0)
                  .map((v) => (
                    <span
                      key={v.id}
                      className="inline-flex items-center gap-1.5 bg-white border border-zinc-200 px-2.5 py-1 rounded-lg text-xs font-semibold text-zinc-600"
                    >
                      <div
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: v.color || '#64748B' }}
                      />
                      <span>{v.name}</span>
                      <span className="text-[10px] text-zinc-400 font-normal">(£0.00)</span>
                    </span>
                  ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
