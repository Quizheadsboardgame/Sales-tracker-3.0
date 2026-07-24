import React, { useState } from 'react';
import { DollarSign, Coins, Clock, ArrowRight, ClipboardList, CheckCircle2, RefreshCw, Plus, Send, HelpCircle, FileText, Download } from 'lucide-react';
import { CashoutRequest, TradeIn, Sale, Vendor } from '../types';
import { isSaleMature, calculateVendorBalances } from '../payoutUtils';
import { downloadVendorClearedBalancePDF } from '../pdfUtils';

interface CashoutAndTradeInProps {
  vendor: Vendor;
  sales: Sale[];
  cashouts: CashoutRequest[];
  tradeIns: TradeIn[];
  onRequestCashout: (vendorId: string, amount: number) => Promise<void>;
  onAddTradeIn: (tradeInData: {
    vendorId: string;
    details: string;
    estimatedValue: number;
    creditApplied: number;
  }) => Promise<void>;
}

export default function CashoutAndTradeIn({
  vendor,
  sales,
  cashouts,
  tradeIns,
  onRequestCashout,
  onAddTradeIn
}: CashoutAndTradeInProps) {
  // Navigation sub-tabs
  const [cashoutTab, setCashoutTab] = useState<'cashout' | 'tradein'>('cashout');

  // Form states
  const [requestedAmountInput, setRequestedAmountInput] = useState<string>('');
  const [tradeInDetails, setTradeInDetails] = useState('');
  const [estimatedValue, setEstimatedValue] = useState('');
  const [creditRequested, setCreditRequested] = useState('');

  // Statuses
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Accurate Vendor Balances incorporating Trade-In deductions
  const now = new Date();
  const vendorBalances = calculateVendorBalances(vendor, sales, cashouts, now);
  const availableCash = vendorBalances.availableCash;
  const pendingCash = vendorBalances.pendingCash;
  const spentOnTradeIns = vendorBalances.spentOnTradeIns;

  // Keep default requested amount input synced if empty
  const currentRequestedNum = requestedAmountInput !== '' ? Number(requestedAmountInput) : availableCash;

  // Filter cashouts & trade-ins for this vendor
  const vendorCashouts = cashouts.filter((c) => c.vendorId === vendor.id);
  const vendorTradeIns = tradeIns.filter((t) => t.vendorId === vendor.id);

  // Handle cashout request
  const handleCashoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (availableCash <= 0) {
      setErrorMsg("You do not have any mature earnings available for payout right now.");
      return;
    }

    const withdrawAmt = requestedAmountInput !== '' ? Number(requestedAmountInput) : availableCash;

    if (isNaN(withdrawAmt) || withdrawAmt <= 0) {
      setErrorMsg("Please enter a valid cash out amount greater than £0.");
      return;
    }

    if (withdrawAmt > availableCash + 0.001) {
      setErrorMsg(`Requested amount (£${withdrawAmt.toFixed(2)}) exceeds your available cleared balance of £${availableCash.toFixed(2)}.`);
      return;
    }

    setLoading(true);
    try {
      await onRequestCashout(vendor.id, withdrawAmt);
      setSuccessMsg(`Success! Requested payout of £${withdrawAmt.toFixed(2)}.`);
      setRequestedAmountInput('');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to submit cashout request.");
    } finally {
      setLoading(false);
    }
  };

  // Handle trade-in log
  const handleTradeInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!tradeInDetails.trim()) {
      setErrorMsg("Please provide card details for the trade-in.");
      return;
    }

    const estValNum = Number(estimatedValue);
    const reqCredNum = Number(creditRequested || estimatedValue);

    if (isNaN(estValNum) || estValNum <= 0) {
      setErrorMsg("Please enter a valid estimated market value.");
      return;
    }

    setLoading(true);
    try {
      await onAddTradeIn({
        vendorId: vendor.id,
        details: tradeInDetails,
        estimatedValue: estValNum,
        creditApplied: reqCredNum
      });

      setSuccessMsg("Trade-in details logged and Newton has been updated!");
      setTradeInDetails('');
      setEstimatedValue('');
      setCreditRequested('');

      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to log trade-in.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Tab select side-bar (4 Cols on Desktop) */}
      <div className="lg:col-span-4 bg-white rounded-xl border border-zinc-200 p-5 shadow-xs space-y-4 h-fit">
        <div>
          <h4 className="font-extrabold text-zinc-900 text-xs uppercase tracking-wider">Funds Management</h4>
          <p className="text-[11px] text-zinc-500 font-medium">Choose how to withdraw or leverage your stall earnings</p>
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <button
            id="btn-nav-cashout"
            onClick={() => setCashoutTab('cashout')}
            className={`w-full py-3 px-4 rounded-lg text-xs font-bold transition-all text-left flex items-center justify-between ${
              cashoutTab === 'cashout'
                ? 'bg-zinc-100 text-blue-600 border-l-4 border-blue-600 rounded-l-none'
                : 'hover:bg-zinc-50 text-zinc-500 hover:text-zinc-700'
            }`}
          >
            <span className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" /> Withdraw Cash (Mature)
            </span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          <button
            id="btn-nav-tradein"
            onClick={() => setCashoutTab('tradein')}
            className={`w-full py-3 px-4 rounded-lg text-xs font-bold transition-all text-left flex items-center justify-between ${
              cashoutTab === 'tradein'
                ? 'bg-zinc-100 text-blue-600 border-l-4 border-blue-600 rounded-l-none'
                : 'hover:bg-zinc-50 text-zinc-500 hover:text-zinc-700'
            }`}
          >
            <span className="flex items-center gap-2">
              <Coins className="w-4 h-4" /> Trade-In / Site Credit
            </span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Global summary card inside sidebar */}
        <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-200 space-y-3.5">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">
            Vendor Financials
          </span>
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-bold">
              <span className="text-zinc-500">Ready to Withdraw:</span>
              <span className="text-emerald-600">£{availableCash.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs font-bold">
              <span className="text-zinc-500">Locked Pending:</span>
              <span className="text-amber-600">£{pendingCash.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs font-bold pt-1 border-t border-zinc-200">
              <span className="text-zinc-500">Site/Trade Credit:</span>
              <span className="text-zinc-900">£{vendor.tradeCredit.toFixed(2)}</span>
            </div>
          </div>

          <button
            id="btn-sidebar-download-pdf"
            onClick={() => downloadVendorClearedBalancePDF(vendor, sales, cashouts)}
            className="w-full mt-2 py-2 px-3 bg-white hover:bg-zinc-100 border border-zinc-300 text-zinc-800 text-[11px] font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-2xs"
          >
            <FileText className="w-3.5 h-3.5 text-blue-600" /> Statement PDF
          </button>
        </div>
      </div>

      {/* Main Panel box (8 Cols on Desktop) */}
      <div className="lg:col-span-8 bg-white rounded-xl border border-zinc-200 shadow-xs p-6">
        {/* Error / Success */}
        {successMsg && (
          <div className="mb-6 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg p-4 font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            {successMsg}
          </div>
        )}
        {errorMsg && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg p-4 font-semibold">
            {errorMsg}
          </div>
        )}

        {/* Tab 1: CASH OUT REQUESTS */}
        {cashoutTab === 'cashout' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-zinc-100">
              <div className="space-y-1">
                <h3 className="text-base font-black text-zinc-950 tracking-tight">Withdraw Mature Stall Funds</h3>
                <p className="text-xs text-zinc-500 font-medium">Sales clear on Friday payout days (Wednesday sales take 16 days, Saturday sales take 13 days) before becoming eligible for withdrawal.</p>
              </div>
              <button
                id="btn-download-pdf-statement"
                onClick={() => downloadVendorClearedBalancePDF(vendor, sales, cashouts)}
                className="px-3.5 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 text-xs font-bold rounded-lg transition-all border border-zinc-200 shrink-0 flex items-center gap-1.5 shadow-2xs"
                title="Download detailed PDF statement of sold cards & cleared balance"
              >
                <Download className="w-3.5 h-3.5 text-blue-600" />
                <span>Download Statement (PDF)</span>
              </button>
            </div>

            {/* Cashout calculator & request card */}
            <div className="bg-zinc-900 text-white rounded-xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-zinc-800">
                <div>
                  <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest block">
                    Eligible Hold Cleared Balance
                  </span>
                  <span className="text-3xl font-black tracking-tight block mt-1 text-emerald-400">
                    £{availableCash.toFixed(2)}
                  </span>
                  <span className="text-xs font-semibold text-zinc-400 block mt-0.5">
                    {spentOnTradeIns > 0 ? (
                      <>
                        Raw cleared sales: <strong>£{vendorBalances.rawClearFunds.toFixed(2)}</strong> (minus <strong>£{spentOnTradeIns.toFixed(2)}</strong> spent on trade-ins)
                      </>
                    ) : (
                      <>
                        Total of {sales.filter((s) => s.vendorId === vendor.id && !s.cashedOut && !s.cashoutRequestId && isSaleMature(s.date, now)).length} mature card transactions
                      </>
                    )}
                  </span>
                </div>

                {availableCash > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-center">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase mr-1">Quick Select:</span>
                    <button
                      type="button"
                      id="btn-preset-25"
                      onClick={() => setRequestedAmountInput((availableCash * 0.25).toFixed(2))}
                      className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold rounded cursor-pointer transition-colors"
                    >
                      25%
                    </button>
                    <button
                      type="button"
                      id="btn-preset-50"
                      onClick={() => setRequestedAmountInput((availableCash * 0.50).toFixed(2))}
                      className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold rounded cursor-pointer transition-colors"
                    >
                      50%
                    </button>
                    <button
                      type="button"
                      id="btn-preset-75"
                      onClick={() => setRequestedAmountInput((availableCash * 0.75).toFixed(2))}
                      className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold rounded cursor-pointer transition-colors"
                    >
                      75%
                    </button>
                    <button
                      type="button"
                      id="btn-preset-max"
                      onClick={() => setRequestedAmountInput(availableCash.toFixed(2))}
                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded cursor-pointer transition-colors"
                    >
                      Full Balance
                    </button>
                  </div>
                )}
              </div>

              {availableCash > 0 ? (
                <form onSubmit={handleCashoutSubmit} className="space-y-3 pt-1">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <div className="relative flex-1">
                      <label htmlFor="input-withdraw-amount" className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                        Withdrawal Amount (£)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 font-bold text-sm">£</span>
                        <input
                          id="input-withdraw-amount"
                          type="number"
                          step="0.01"
                          min="0.01"
                          max={availableCash}
                          value={requestedAmountInput}
                          onChange={(e) => setRequestedAmountInput(e.target.value)}
                          placeholder={availableCash.toFixed(2)}
                          className="w-full pl-7 pr-3 py-2 bg-zinc-800 border border-zinc-700 focus:border-blue-500 rounded-lg text-white font-bold text-sm focus:outline-none transition-colors"
                        />
                      </div>
                    </div>

                    <button
                      id="btn-request-cashout-submit"
                      type="submit"
                      disabled={loading || availableCash <= 0 || (requestedAmountInput !== '' && Number(requestedAmountInput) <= 0)}
                      className="sm:self-end py-2.5 px-6 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-extrabold text-xs rounded-lg tracking-wide transition-all shadow-xs flex items-center justify-center gap-1.5 focus:outline-none cursor-pointer"
                    >
                      {loading ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Lodging request...
                        </>
                      ) : (
                        <>
                          <DollarSign className="w-4 h-4" /> Request Cash Out
                        </>
                      )}
                    </button>
                  </div>

                  {requestedAmountInput !== '' && !isNaN(Number(requestedAmountInput)) && Number(requestedAmountInput) > 0 && (
                    <div className="text-[11px] text-zinc-400 font-medium flex justify-between pt-1">
                      <span>Requesting: <strong className="text-white">£{Number(requestedAmountInput).toFixed(2)}</strong></span>
                      <span>Remaining Cleared Balance: <strong className="text-emerald-400">£{Math.max(0, availableCash - Number(requestedAmountInput)).toFixed(2)}</strong></span>
                    </div>
                  )}
                </form>
              ) : (
                <p className="text-xs text-zinc-400 font-medium">You have £0.00 cleared funds available to withdraw right now.</p>
              )}
            </div>

            {/* Cashout History */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Your Cash Out History</h4>

              {vendorCashouts.length === 0 ? (
                <div className="py-12 text-center bg-zinc-50 rounded-lg border border-dashed border-zinc-200 text-xs text-zinc-400 font-semibold">
                  No payout history on record for your account.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                  {vendorCashouts.slice().sort((a,b)=> new Date(b.date).getTime() - new Date(a.date).getTime()).map((req) => (
                    <div key={req.id} className="bg-zinc-50 border border-zinc-200 rounded-lg p-3.5 flex justify-between items-center text-xs">
                      <div>
                        <span className="font-extrabold text-zinc-800 block">
                          Payout of £{req.amount.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-zinc-400 font-semibold block mt-0.5">
                          Requested: {new Date(req.date).toLocaleDateString('en-GB')}
                        </span>
                      </div>
                      <div>
                        {req.status === 'approved' ? (
                          <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 font-extrabold text-[9px] px-2 py-0.5 rounded uppercase">
                            Paid out {req.payoutDate ? new Date(req.payoutDate).toLocaleDateString('en-GB') : ''}
                          </span>
                        ) : req.status === 'pending' ? (
                          <span className="bg-amber-50 text-amber-800 border border-amber-200 font-extrabold text-[9px] px-2 py-0.5 rounded uppercase animate-pulse">
                            Awaiting Newton approval
                          </span>
                        ) : (
                          <span className="bg-red-50 text-red-700 border border-red-200 font-extrabold text-[9px] px-2 py-0.5 rounded uppercase">
                            Declined
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: TRADE-IN CREATING */}
        {cashoutTab === 'tradein' && (
          <div className="space-y-6 animate-in fade-in duration-100">
            <div className="space-y-1">
              <h3 className="text-base font-black text-zinc-950 tracking-tight">Trade-In & Stored Site Credit</h3>
              <p className="text-xs text-zinc-500 font-medium">Keep your funds stored in the site to receive bonus value for trade-ins or negotiate card purchases from Newton or peer vendors.</p>
            </div>

            {/* Quick alert bar */}
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg flex gap-3 text-xs text-blue-800 font-medium">
              <HelpCircle className="w-5 h-5 text-blue-500 shrink-0" />
              <p>Trading in your Pokemon cards directly into Newton's Collectables? Log details below to submit a pending trade-in record. Newton will inspect the condition of your cards on Wednesday/Saturday and credit your account balance instantly.</p>
            </div>

            {/* Log Trade-In form */}
            <form onSubmit={handleTradeInSubmit} className="bg-zinc-50/50 rounded-lg border border-zinc-200 p-5 space-y-4">
              <h4 className="text-xs font-bold text-zinc-700 uppercase tracking-wider block">Log New Card Trade-In</h4>
              
              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
                  What cards are you trading in? (include Card Name, Set, and Condition)
                </label>
                <textarea
                  id="tradein-details-input"
                  rows={2}
                  required
                  placeholder="e.g. 1x Lugia V Alt Art (Lost Origin) - Pack Fresh Near Mint, 50x Vintage Rare Bulk"
                  value={tradeInDetails}
                  onChange={(e) => setTradeInDetails(e.target.value)}
                  className="w-full bg-white border border-zinc-200 focus:ring-2 focus:ring-blue-100 focus:border-blue-600 rounded-lg p-3 text-xs font-medium outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
                    Estimated Market Value (£)
                  </label>
                  <input
                    id="tradein-market-val"
                    type="number"
                    required
                    placeholder="e.g. 250.00"
                    value={estimatedValue}
                    onChange={(e) => setEstimatedValue(e.target.value)}
                    className="w-full bg-white border border-zinc-200 focus:ring-2 focus:ring-blue-100 focus:border-blue-600 rounded-lg py-2 px-3 text-xs font-bold outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
                    Requested Stored Credit (£)
                  </label>
                  <input
                    id="tradein-requested-credit"
                    type="number"
                    placeholder="e.g. 235.00"
                    value={creditRequested}
                    onChange={(e) => setCreditRequested(e.target.value)}
                    className="w-full bg-white border border-zinc-200 focus:ring-2 focus:ring-blue-100 focus:border-blue-600 rounded-lg py-2 px-3 text-xs font-bold outline-none"
                  />
                </div>
              </div>

              <button
                id="btn-tradein-submit"
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-950 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Submitting request...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" /> Submit Trade-In Report
                  </>
                )}
              </button>
            </form>

            {/* Trade In Logs */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Your Trade-In Records</h4>

              {vendorTradeIns.length === 0 ? (
                <div className="py-12 text-center bg-zinc-50 rounded-lg border border-dashed border-zinc-200 text-xs text-zinc-400 font-semibold">
                  No logged trade-ins for your account.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                  {vendorTradeIns.slice().sort((a,b)=> new Date(b.date).getTime() - new Date(a.date).getTime()).map((tr) => (
                    <div key={tr.id} className="bg-zinc-50 border border-zinc-200 rounded-lg p-3.5 flex justify-between items-start text-xs">
                      <div>
                        <span className="font-extrabold text-zinc-800 block leading-tight max-w-[200px]">
                          {tr.details}
                        </span>
                        <span className="text-[10px] text-zinc-400 font-bold block mt-1 uppercase">
                          Est. Value: £{tr.estimatedValue.toFixed(2)} • Stored Credit requested: £{tr.creditApplied.toFixed(2)}
                        </span>
                      </div>
                      <div>
                        {tr.status === 'approved' ? (
                          <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 font-extrabold text-[9px] px-2 py-0.5 rounded uppercase">
                            Approved & Credited
                          </span>
                        ) : tr.status === 'pending' ? (
                          <span className="bg-amber-50 text-amber-800 border border-amber-200 font-extrabold text-[9px] px-2 py-0.5 rounded uppercase animate-pulse">
                            Pending Newton review
                          </span>
                        ) : (
                          <span className="bg-red-50 text-red-700 border border-red-200 font-extrabold text-[9px] px-2 py-0.5 rounded uppercase">
                            Declined
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
