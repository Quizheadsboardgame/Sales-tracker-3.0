import React from 'react';
import { TrendingUp, DollarSign, Clock, Coins, Percent, ArrowUpRight, CheckCircle2, ShieldCheck } from 'lucide-react';
import { Sale, Vendor } from '../types';

interface DashboardHomeProps {
  vendor: Vendor;
  sales: Sale[];
  onNavigate: (tab: string) => void;
}

export default function DashboardHome({ vendor, sales, onNavigate }: DashboardHomeProps) {
  // Filter sales for this vendor
  const vendorSales = sales.filter((s) => s.vendorId === vendor.id);

  // Time calculations based on 2-week payout maturation
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const TWO_WEEKS_MS = 14 * MS_PER_DAY;
  const now = new Date("2026-07-14T06:28:56-07:00"); // current local time injected

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

  // Math for Payout Maturation
  let availableCash = 0;
  let pendingCash = 0;
  let cashedOutTotal = 0;

  vendorSales.forEach((sale) => {
    if (sale.cashedOut) {
      cashedOutTotal += sale.vendorEarnings;
    } else if (sale.cashoutRequestId) {
      // If it has a cashout request (pending or approved but not cleared), it's not available
      // but let's see, pending requests are kept track of.
    } else {
      const saleTime = new Date(sale.date).getTime();
      const ageMs = now.getTime() - saleTime;
      if (ageMs >= TWO_WEEKS_MS) {
        availableCash += sale.vendorEarnings;
      } else {
        pendingCash += sale.vendorEarnings;
      }
    }
  });

  // Calculate overall gross and net sales
  const allTimeGross = vendorSales.reduce((acc, s) => acc + s.price, 0);
  const allTimeNet = vendorSales.reduce((acc, s) => acc + s.vendorEarnings, 0);

  return (
    <div className="space-y-6">
      {/* Welcome Banner in Geometric Balance style */}
      <div className="bg-zinc-900 text-white rounded-xl p-6 border border-zinc-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm relative overflow-hidden">
        <div className="relative z-10">
          <span className="bg-blue-600 text-white text-[9px] font-extrabold px-2.5 py-1 rounded uppercase tracking-wider">
            Active Vendor Session
          </span>
          <h2 className="text-xl font-bold mt-2 tracking-tight text-white">{vendor.name}</h2>
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
          <button
            id="btn-goto-trades"
            onClick={() => onNavigate('trades')}
            className="flex-1 md:flex-none px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm"
          >
            P2P Trades
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
              &lt; 14d
            </span>
          </div>
          <div className="mt-4">
            <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider block">
              Pending Payouts
            </span>
            <span className="text-2xl font-bold text-zinc-900 tracking-tight block mt-0.5">
              £{pendingCash.toFixed(2)}
            </span>
            <span className="text-[10px] font-semibold text-zinc-400 block mt-1">
              Matures 2 weeks post-sale
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
              For stall & peer trades
            </span>
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
          <button
            id="btn-quick-payout"
            onClick={() => onNavigate('payouts')}
            className="text-xs text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1 focus:outline-none"
          >
            Cash Out / Trade-In Manager <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
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
                  const saleTime = new Date(sale.date).getTime();
                  const ageMs = now.getTime() - saleTime;
                  const daysRemaining = Math.max(0, Math.ceil((TWO_WEEKS_MS - ageMs) / MS_PER_DAY));
                  const isMature = ageMs >= TWO_WEEKS_MS;

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
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-blue-600 bg-blue-50 border border-blue-200/40 px-2.5 py-0.5 rounded">
                            Ready
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-zinc-500 bg-zinc-100 border border-zinc-200/40 px-2.5 py-0.5 rounded">
                            Matures in {daysRemaining}d
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
          <p>Sales are permanently logged with timestamps. Commission amounts are locked at the precise moment of sale. The 2-week payout hold is an operational constant, ensuring full transaction transparency and security for Newton's Collectables.</p>
        </div>
      </div>
    </div>
  );
}
