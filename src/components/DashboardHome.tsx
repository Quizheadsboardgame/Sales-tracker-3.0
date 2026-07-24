import React from 'react';
import { TrendingUp, DollarSign, Clock, Coins, Percent, ArrowUpRight, CheckCircle2, ShieldCheck, Scale, ArrowDownRight, ClipboardList, FileText, Download } from 'lucide-react';
import { Sale, Vendor, CashoutRequest, TradeIn } from '../types';
import { isSaleMature, getRemainingDays, getPayoutDate, calculateVendorBalances } from '../payoutUtils';
import { downloadVendorClearedBalancePDF } from '../pdfUtils';

interface DashboardHomeProps {
  vendor: Vendor;
  sales: Sale[];
  cashouts: CashoutRequest[];
  tradeIns: TradeIn[];
  onNavigate: (tab: string) => void;
}

export default function DashboardHome({ vendor, sales, cashouts, tradeIns, onNavigate }: DashboardHomeProps) {
  // Filter sales for this vendor
  const vendorSales = sales.filter((s) => s.vendorId === vendor.id);

  // Time calculations based on dynamic payout maturation
  const now = new Date();

  // Today's Sales (Wednesday or Saturday are busy market days!)
  const todaySales = vendorSales.filter((s) => {
    const saleDate = new Date(s.date);
    return (
      saleDate.getFullYear() === now.getFullYear() &&
      saleDate.getMonth() === now.getMonth() &&
      saleDate.getDate() === now.getDate()
    );
  });

  const todayGross = todaySales.reduce((acc, curr) => acc + curr.price, 0);
  const todayEarnings = todaySales.reduce((acc, curr) => acc + curr.vendorEarnings, 0);

  // Accurate Vendor Balances incorporating Trade-In deductions
  const vendorBalances = calculateVendorBalances(vendor, sales, cashouts, now);
  const availableCash = vendorBalances.availableCash;
  const pendingCash = vendorBalances.pendingCash;
  const pendingCashoutsAmount = vendorBalances.pendingCashoutsAmount;
  const totalPendingPayouts = pendingCash + pendingCashoutsAmount;
  const consolidatedBalance = vendorBalances.consolidatedBalance;

  // Filter cashouts & trade-ins for this vendor
  const vendorCashouts = cashouts.filter((c) => c.vendorId === vendor.id);
  const vendorTradeIns = tradeIns.filter((t) => t.vendorId === vendor.id);

  // Total spent on trade-ins (approved negative trade-ins, logged at the till)
  const spentOnTradeIns = vendorTradeIns
    .filter((t) => t.status === 'approved' && t.creditApplied < 0)
    .reduce((sum, t) => sum + Math.abs(t.creditApplied), 0);

  // Total credit earned (approved positive trade-ins logged by vendor)
  const earnedTradeCredit = vendorTradeIns
    .filter((t) => t.status === 'approved' && t.creditApplied > 0)
    .reduce((sum, t) => sum + t.creditApplied, 0);

  // Calculate overall gross and net sales
  const allTimeGross = vendorSales.reduce((acc, s) => acc + s.price, 0);
  const allTimeNet = vendorSales.reduce((acc, s) => acc + s.vendorEarnings, 0);

  return (
    <div className="space-y-6">
      {/* Welcome Banner in Geometric Balance style */}
      <div className="bg-zinc-900 text-white rounded-xl p-6 border border-zinc-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm relative overflow-hidden">
        <div className="relative z-10">
          <span className="text-white text-[9px] font-extrabold px-2.5 py-1 rounded uppercase tracking-wider" style={{ backgroundColor: vendor.color || '#2563EB' }}>
            Active Vendor Session
          </span>
          <div className="flex items-center gap-2.5 mt-2">
            <div className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-xs shrink-0" style={{ backgroundColor: vendor.color || '#64748B' }} />
            <h2 className="text-xl font-bold tracking-tight text-white">{vendor.name}</h2>
          </div>
          <p className="text-zinc-400 text-xs mt-1">
            Personal commission structure: <span className="text-blue-400 font-bold">{(vendor.commission * 100).toFixed(0)}% Newton Commission</span> for stall space.
          </p>
        </div>
        <div className="flex gap-2 w-full md:w-auto relative z-10">
          <button
            id="btn-goto-staff"
            onClick={() => onNavigate('staff')}
            className="flex-1 md:flex-none px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5"
          >
            Log Sales
          </button>
        </div>
      </div>

      {/* Main Metric Cards Grid - Geometric Balance layout */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Today's Earnings */}
        <div className="bg-white rounded-xl border border-zinc-200 p-4 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="p-2 bg-zinc-50 border border-zinc-100 rounded-lg">
              <TrendingUp className="w-4 h-4 text-zinc-600" />
            </div>
            <span className="text-[9px] font-bold text-green-700 bg-green-50 border border-green-200/50 px-2 py-0.5 rounded uppercase">
              Today
            </span>
          </div>
          <div className="mt-4">
            <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider block">
              Today's Net
            </span>
            <span className="text-2xl font-bold text-zinc-900 tracking-tight block mt-0.5">
              £{todayEarnings.toFixed(2)}
            </span>
            <span className="text-[10px] font-semibold text-zinc-400 block mt-1">
              Gross: £{todayGross.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Metric 2: Available Cash */}
        <div className="bg-white rounded-xl border border-zinc-200 p-4 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="p-2 bg-zinc-50 border border-zinc-100 rounded-lg">
              <DollarSign className="w-4 h-4 text-zinc-600" />
            </div>
            <span className="text-[9px] font-bold text-blue-600 bg-blue-50 border border-blue-150/50 px-2 py-0.5 rounded uppercase">
              Mature
            </span>
          </div>
          <div className="mt-4">
            <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider block">
              Available Cash
            </span>
            <span className="text-2xl font-bold text-zinc-900 tracking-tight block mt-0.5">
              £{availableCash.toFixed(2)}
            </span>
            <span className="text-[10px] font-semibold text-zinc-400 block mt-1">
              Eligible to Cash Out now
            </span>
          </div>
        </div>

        {/* Metric 3: Pending Balance */}
        <div className="bg-white rounded-xl border border-zinc-200 p-4 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="p-2 bg-zinc-50 border border-zinc-100 rounded-lg">
              <Clock className="w-4 h-4 text-zinc-600" />
            </div>
            <span className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200/50 px-2 py-0.5 rounded uppercase">
              Hold
            </span>
          </div>
          <div className="mt-4">
            <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider block">
              Pending Payouts
            </span>
            <span className="text-2xl font-bold text-zinc-900 tracking-tight block mt-0.5">
              £{totalPendingPayouts.toFixed(2)}
            </span>
            <span className="text-[10px] font-semibold text-zinc-400 block mt-1">
              Hold: £{pendingCash.toFixed(2)} • Requests: £{pendingCashoutsAmount.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Metric 4: Trade/Store Credit */}
        <div className="bg-white rounded-xl border border-zinc-200 p-4 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="p-2 bg-zinc-50 border border-zinc-100 rounded-lg">
              <Coins className="w-4 h-4 text-zinc-600" />
            </div>
            <span className="text-[9px] font-bold text-zinc-600 bg-zinc-100 border border-zinc-200/50 px-2 py-0.5 rounded uppercase">
              Stored
            </span>
          </div>
          <div className="mt-4">
            <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider block">
              Trade Credit
            </span>
            <span className="text-2xl font-bold text-zinc-900 tracking-tight block mt-0.5">
              £{vendor.tradeCredit.toFixed(2)}
            </span>
            <span className="text-[10px] font-semibold text-zinc-400 block mt-1">
              Earned: £{earnedTradeCredit.toFixed(2)} • Spent: £{spentOnTradeIns.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Stall Financial Ledger & Balance Sheet (Bento Card) */}
      <div className="bg-white rounded-xl border border-zinc-200 p-6 shadow-sm space-y-6">
        <div>
          <h3 className="text-sm font-black text-zinc-950 uppercase tracking-wider flex items-center gap-2">
            <Scale className="w-4.5 h-4.5 text-zinc-700" /> Stall Ledger & Financial Balance Sheet
          </h3>
          <p className="text-xs text-zinc-400 font-medium mt-1">
            Detailed breakdown of pending payouts, trade-in investments, and net account balances
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 divide-y md:divide-y-0 md:divide-x divide-zinc-200">
          {/* Column 1: Pending Payouts */}
          <div className="space-y-4 pr-0 md:pr-4">
            <span className="text-[10px] font-bold text-amber-700 uppercase tracking-widest block bg-amber-50 border border-amber-100/50 px-2.5 py-1 rounded w-fit">
              1. Pending Payouts
            </span>
            <div className="space-y-2.5">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500 font-medium">Sales on Hold (13-16d hold):</span>
                <span className="font-extrabold text-zinc-800">£{pendingCash.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500 font-medium">Awaiting Newton Approval:</span>
                <span className="font-extrabold text-zinc-800">£{pendingCashoutsAmount.toFixed(2)}</span>
              </div>
              <div className="pt-2 border-t border-dashed border-zinc-200 flex justify-between text-xs font-black">
                <span className="text-zinc-900 uppercase tracking-wider">Total Pending Payouts:</span>
                <span className="text-zinc-950 text-sm">£{totalPendingPayouts.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Column 2: Trade-In Expenditure */}
          <div className="space-y-4 pt-4 md:pt-0 md:px-6">
            <span className="text-[10px] font-bold text-zinc-700 uppercase tracking-widest block bg-zinc-100 border border-zinc-200/50 px-2.5 py-1 rounded w-fit">
              2. Trade-In Ledger
            </span>
            <div className="space-y-2.5">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500 font-medium">Store Credit Received:</span>
                <span className="font-extrabold text-emerald-600">＋£{earnedTradeCredit.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500 font-medium">Spent on Customer Trade-Ins:</span>
                <span className="font-extrabold text-red-600">－£{spentOnTradeIns.toFixed(2)}</span>
              </div>
              <div className="pt-2 border-t border-dashed border-zinc-200 flex justify-between text-xs font-black">
                <span className="text-zinc-900 uppercase tracking-wider">Trade Credit Balance:</span>
                <span className="text-zinc-950 text-sm">£{vendor.tradeCredit.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Column 3: Current Balances & Net Worth */}
          <div className="space-y-4 pt-4 md:pt-0 md:pl-6">
            <span className="text-[10px] font-bold text-blue-700 uppercase tracking-widest block bg-blue-50 border border-blue-100/50 px-2.5 py-1 rounded w-fit">
              3. Account Balance
            </span>
            <div className="space-y-2.5">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500 font-medium">Withdrawable Cash (Cleared):</span>
                <span className="font-extrabold text-zinc-800">£{availableCash.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500 font-medium">Pending Funds (Hold/Requests):</span>
                <span className="font-extrabold text-zinc-800">£{totalPendingPayouts.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500 font-medium">Trade Credit Balance:</span>
                <span className="font-extrabold text-zinc-800">£{vendor.tradeCredit.toFixed(2)}</span>
              </div>
              <div className="pt-2 border-t border-zinc-200 flex justify-between text-xs font-black">
                <span className="text-zinc-900 uppercase tracking-wider">Consolidated Stall Balance:</span>
                <span className="text-blue-600 text-sm">£{consolidatedBalance.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sales Maturation Tracking Section */}
      <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
          <div>
            <h3 className="text-base font-bold text-zinc-900 tracking-tight flex items-center gap-1.5">
              Sales History & Payout Timeline
            </h3>
            <p className="text-xs text-zinc-400 font-medium">
              Commission calculations, current statuses, and availability tracking
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              id="btn-dash-download-pdf"
              onClick={() => downloadVendorClearedBalancePDF(vendor, sales, cashouts)}
              className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 text-xs font-bold rounded-lg transition-all border border-zinc-200 flex items-center gap-1.5 shadow-2xs"
              title="Download PDF report of sold cards and cleared balance"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              <span>Download PDF</span>
            </button>
            <button
              id="btn-quick-payout"
              onClick={() => onNavigate('payouts')}
              className="text-xs text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1 focus:outline-none"
            >
              Cash Out / Trade-In Manager <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {vendorSales.length === 0 ? (
          <div className="text-center py-10 bg-zinc-50 rounded-xl border border-dashed border-zinc-200">
            <p className="text-sm font-semibold text-zinc-500">No logged sales yet</p>
            <p className="text-xs text-zinc-400 mt-1">Sales logged by staff will appear here instantly</p>
            <button
              id="btn-first-sale"
              onClick={() => onNavigate('staff')}
              className="mt-4 px-4 py-2 bg-zinc-950 hover:bg-zinc-800 text-white rounded-lg text-xs font-bold transition-all"
            >
              Log First Sale
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                  <th className="pb-3 font-semibold">Item & Sale Date</th>
                  <th className="pb-3 font-semibold">Sale Price</th>
                  <th className="pb-3 font-semibold">Commission ({vendor.commission * 100}%)</th>
                  <th className="pb-3 font-semibold">Net Earnings</th>
                  <th className="pb-3 font-semibold">Payout Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {vendorSales.slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((sale) => {
                  const isMature = isSaleMature(sale.date, now);
                  const daysRemaining = getRemainingDays(sale.date, now);
                  const payoutDateObj = getPayoutDate(sale.date);

                  return (
                    <tr key={sale.id} className="text-xs hover:bg-zinc-50/50 transition-colors">
                      {/* Name & Date */}
                      <td className="py-3.5 pr-3">
                        <span className="font-bold text-zinc-800 block">{sale.itemName}</span>
                        <span className="text-[10px] text-zinc-400">
                          {new Date(sale.date).toLocaleDateString('en-GB', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                            year: '2-digit'
                          })}
                        </span>
                      </td>

                      {/* Gross Price */}
                      <td className="py-3.5 font-semibold text-zinc-700">
                        £{sale.price.toFixed(2)}
                      </td>

                      {/* Commission */}
                      <td className="py-3.5 text-zinc-400 text-xs font-semibold">
                        £{sale.commissionAmount.toFixed(2)}
                      </td>

                      {/* Net Earnings */}
                      <td className="py-3.5 font-bold text-zinc-900">
                        £{sale.vendorEarnings.toFixed(2)}
                      </td>

                      {/* Payout status countdown */}
                      <td className="py-3.5">
                        {sale.cashedOut ? (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-green-700 bg-green-50 border border-green-200/40 px-2.5 py-0.5 rounded">
                            Fully Paid
                          </span>
                        ) : sale.cashoutRequestId ? (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200/40 px-2.5 py-0.5 rounded">
                            Payout Pending
                          </span>
                        ) : isMature ? (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-blue-600 bg-blue-50 border border-blue-200/40 px-2.5 py-0.5 rounded" title={`Mature since: ${payoutDateObj.toLocaleDateString('en-GB')}`}>
                            Ready (Mature)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-zinc-600 bg-zinc-100 border border-zinc-200/60 px-2.5 py-0.5 rounded" title={`Matures on: ${payoutDateObj.toLocaleDateString('en-GB')}`}>
                            {daysRemaining === 1 ? '1 day left' : `${daysRemaining} days left`}
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

      {/* Info card footer */}
      <div className="bg-zinc-50 rounded-xl border border-zinc-200 p-4 flex gap-3">
        <ShieldCheck className="w-5 h-5 text-zinc-400 shrink-0 mt-0.5" />
        <div className="text-xs text-zinc-500 space-y-1">
          <p className="font-bold text-zinc-600">Secure Newton's Ledger Rules</p>
          <p>Sales are permanently logged with timestamps. Newton's Collectables pays out on Fridays: Wednesday sales clear 16 days later, and Saturday sales 13 days later. This protects business cash flow if card trade-ins are executed instead of standard cash sales.</p>
        </div>
      </div>
    </div>
  );
}
