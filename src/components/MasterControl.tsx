import React, { useState } from 'react';
import { ShieldCheck, Users, Percent, PercentIcon, DollarSign, Coins, TrendingUp, Check, X, RefreshCw, Edit2, Plus, Sparkles, AlertCircle } from 'lucide-react';
import { Vendor, Sale, CashoutRequest, TradeIn } from '../types';

interface MasterControlProps {
  vendors: Vendor[];
  sales: Sale[];
  cashouts: CashoutRequest[];
  tradeIns: TradeIn[];
  onUpdateVendor: (vendorData: {
    id: string;
    name: string;
    pin: string;
    commission: number;
  }) => Promise<void>;
  onRespondCashout: (cashoutId: string, status: 'approved' | 'declined') => Promise<void>;
  onRespondTradeIn: (tradeInId: string, status: 'approved' | 'declined', finalCredit?: number) => Promise<void>;
}

export default function MasterControl({
  vendors,
  sales,
  cashouts,
  tradeIns,
  onUpdateVendor,
  onRespondCashout,
  onRespondTradeIn
}: MasterControlProps) {
  // Tabs for Master Control
  const [activeTab, setActiveTab] = useState<'vendors' | 'cashouts' | 'tradeins'>('vendors');

  // Edit vendor modal form state
  const [editingVendorId, setEditingVendorId] = useState<string | null>(null);
  const [vName, setVName] = useState('');
  const [vPin, setVPin] = useState('');
  const [vComm, setVComm] = useState('');

  // Create new vendor state
  const [showCreateForm, setShowCreateForm] = useState(false);

  // loading / status
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Overall analytics calculations
  const totalSalesCount = sales.length;
  const totalGross = sales.reduce((acc, s) => acc + s.price, 0);
  const totalCommEarned = sales.reduce((acc, s) => acc + s.commissionAmount, 0);
  const totalVendorPayouts = sales.reduce((acc, s) => acc + s.vendorEarnings, 0);

  // Active pending requests counts
  const pendingCashouts = cashouts.filter((c) => c.status === 'pending');
  const pendingTradeIns = tradeIns.filter((t) => t.status === 'pending');

  // Start edit vendor
  const handleStartEdit = (vendor: Vendor) => {
    setEditingVendorId(vendor.id);
    setVName(vendor.name);
    setVPin(vendor.pin);
    setVComm((vendor.commission * 100).toString());
  };

  const handleSaveVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!vName.trim() || !vPin || !vComm) {
      setError("Please fill out all fields.");
      return;
    }

    const commPercent = Number(vComm);
    if (isNaN(commPercent) || commPercent < 0 || commPercent > 100) {
      setError("Commission must be a percentage between 0 and 100.");
      return;
    }

    setLoading(true);
    try {
      await onUpdateVendor({
        id: editingVendorId || '',
        name: vName,
        pin: vPin,
        commission: Number((commPercent / 100).toFixed(4))
      });

      setSuccess("Vendor updated successfully!");
      setEditingVendorId(null);
      setVName('');
      setVPin('');
      setVComm('');
      setShowCreateForm(false);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to update vendor.");
    } finally {
      setLoading(false);
    }
  };

  const handleStartCreate = () => {
    setEditingVendorId(null);
    setVName('');
    setVPin('');
    setVComm('10'); // default 10%
    setShowCreateForm(true);
  };

  const handleCashoutDecision = async (id: string, status: 'approved' | 'declined') => {
    setLoading(true);
    setError(null);
    try {
      await onRespondCashout(id, status);
      setSuccess(`Cash out request successfully ${status}!`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to submit response.");
    } finally {
      setLoading(false);
    }
  };

  const handleTradeInDecision = async (id: string, status: 'approved' | 'declined', agreedCredit: number) => {
    setLoading(true);
    setError(null);
    try {
      await onRespondTradeIn(id, status, agreedCredit);
      setSuccess(`Trade-in report successfully ${status}!`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to respond to trade-in.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner admin */}
      <div className="bg-zinc-900 text-white rounded-xl p-6 shadow-xs relative overflow-hidden border border-zinc-800">
        <div className="relative z-10">
          <span className="bg-blue-600 text-white text-[9px] font-extrabold px-2.5 py-1 rounded uppercase tracking-widest">
            STALL CONTROL PANEL
          </span>
          <h2 className="text-xl font-black mt-2 tracking-tight flex items-center gap-1.5">
            <ShieldCheck className="w-5 h-5 text-blue-500" />
            Newton's Master Control
          </h2>
          <p className="text-zinc-400 text-xs font-medium mt-1">
            Global market oversight for Pokemon vendors, commissions, cashing out, and inventory.
          </p>
        </div>
        <div className="absolute right-6 top-6 opacity-5 pointer-events-none">
          <Sparkles className="w-24 h-24 text-zinc-100" />
        </div>
      </div>

      {/* Global Stall Analytics summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-zinc-200 p-4 shadow-xs">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">Stall Gross Revenue</span>
          <span className="text-xl font-black text-zinc-800 tracking-tight block mt-1">£{totalGross.toFixed(2)}</span>
          <span className="text-[10px] font-semibold text-zinc-400 block mt-1">Across {totalSalesCount} logged transactions</span>
        </div>

        <div className="bg-white rounded-xl border border-zinc-200 p-4 shadow-xs">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">Newton Commission (Total)</span>
          <span className="text-xl font-black text-blue-600 tracking-tight block mt-1">£{totalCommEarned.toFixed(2)}</span>
          <span className="text-[10px] font-semibold text-zinc-400 block mt-1">Commission earned for stall space</span>
        </div>

        <div className="bg-white rounded-xl border border-zinc-200 p-4 shadow-xs">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">Payouts to Vendors</span>
          <span className="text-xl font-black text-emerald-600 tracking-tight block mt-1">£{totalVendorPayouts.toFixed(2)}</span>
          <span className="text-[10px] font-semibold text-zinc-400 block mt-1">Paid or pending holding balance</span>
        </div>

        <div className="bg-white rounded-xl border border-zinc-200 p-4 shadow-xs">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">Active Stall Vendors</span>
          <span className="text-xl font-black text-zinc-800 tracking-tight block mt-1">{vendors.length} Vendors</span>
          <span className="text-[10px] font-semibold text-zinc-400 block mt-1">Wednesday & Saturday teams</span>
        </div>
      </div>

      {/* Admin Action Notifications */}
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-lg p-3.5">
          {success}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-lg p-3.5">
          {error}
        </div>
      )}

      {/* Navigation Sub-tab panel */}
      <div className="flex border-b border-zinc-200 gap-6">
        <button
          id="btn-admin-vendors"
          onClick={() => setActiveTab('vendors')}
          className={`pb-3 text-xs font-bold transition-all relative focus:outline-none ${
            activeTab === 'vendors' ? 'text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'
          }`}
        >
          Vendor Structures ({vendors.length})
          {activeTab === 'vendors' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />}
        </button>
        <button
          id="btn-admin-cashouts"
          onClick={() => setActiveTab('cashouts')}
          className={`pb-3 text-xs font-bold transition-all relative focus:outline-none ${
            activeTab === 'cashouts' ? 'text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'
          }`}
        >
          Payout Approvals ({pendingCashouts.length})
          {activeTab === 'cashouts' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />}
        </button>
        <button
          id="btn-admin-tradeins"
          onClick={() => setActiveTab('tradeins')}
          className={`pb-3 text-xs font-bold transition-all relative focus:outline-none ${
            activeTab === 'tradeins' ? 'text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'
          }`}
        >
          Trade-In Verifications ({pendingTradeIns.length})
          {activeTab === 'tradeins' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />}
        </button>
      </div>

      {/* Panel 1: VENDOR SETUP */}
      {activeTab === 'vendors' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-extrabold text-zinc-900 uppercase tracking-wider">Vendor Management Structures</h3>
              <p className="text-xs text-zinc-500 font-medium">Add new sellers, audit personal security PINs, and adjust commission schedules</p>
            </div>
            <button
              id="btn-admin-create-vendor"
              onClick={handleStartCreate}
              className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" /> Add Vendor
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {vendors.map((v) => (
              <div key={v.id} className="bg-white rounded-xl border border-zinc-200 p-5 shadow-xs flex justify-between items-start">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-zinc-400 block tracking-widest uppercase">
                    VENDOR ID: {v.id}
                  </span>
                  <h4 className="font-extrabold text-zinc-800 text-sm">{v.name}</h4>
                  
                  <div className="pt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-xs font-semibold text-zinc-500">
                    <span className="flex items-center gap-1 bg-zinc-50 border border-zinc-200 px-2 py-0.5 rounded">
                      <Percent className="w-3.5 h-3.5 text-zinc-400" /> Commission: <strong className="text-zinc-700">{(v.commission * 100).toFixed(1)}%</strong>
                    </span>
                    <span className="flex items-center gap-1 bg-zinc-50 border border-zinc-200 px-2 py-0.5 rounded">
                      PIN: <strong className="text-zinc-700 font-mono tracking-wider">{v.pin}</strong>
                    </span>
                    <span className="flex items-center gap-1 bg-blue-50/50 border border-blue-100 px-2 py-0.5 rounded text-blue-700">
                      Credit Balance: <strong>£{v.tradeCredit.toFixed(2)}</strong>
                    </span>
                  </div>
                </div>

                <button
                  id={`btn-edit-vendor-${v.id}`}
                  onClick={() => handleStartEdit(v)}
                  className="p-2 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-zinc-600 rounded-lg transition-all cursor-pointer"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Panel 2: CASHOUT APPROVALS */}
      {activeTab === 'cashouts' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-extrabold text-zinc-900 uppercase tracking-wider">Pending Payout Disbursements</h3>
            <p className="text-xs text-zinc-500 font-medium">Verify hold constraints have cleared, then mark cashouts as approved</p>
          </div>

          {pendingCashouts.length === 0 ? (
            <div className="py-14 text-center bg-white border border-zinc-200 rounded-xl shadow-xs">
              <span className="text-xs text-zinc-400 font-bold">No pending cash out requests</span>
              <p className="text-[10px] text-zinc-400 mt-0.5">Vendors will send requests once hold bounds clear</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingCashouts.map((req) => (
                <div key={req.id} className="bg-white border border-zinc-200 rounded-xl p-5 shadow-xs flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                  <div>
                    <span className="bg-blue-50 border border-blue-100 text-blue-700 text-[9px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wider">
                      Request ID: {req.id}
                    </span>
                    <h4 className="text-sm font-extrabold text-zinc-800 mt-1.5">
                      {req.vendorName} is cashing out <span className="text-emerald-600 font-black">£{req.amount.toFixed(2)}</span>
                    </h4>
                    <p className="text-[11px] text-zinc-400 font-semibold mt-1">
                      Submitted on: {new Date(req.date).toLocaleDateString('en-GB')} at {new Date(req.date).toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'})}
                    </p>
                  </div>

                  <div className="flex gap-2 shrink-0">
                    <button
                      id={`btn-approve-cashout-${req.id}`}
                      onClick={() => handleCashoutDecision(req.id, 'approved')}
                      disabled={loading}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 focus:outline-none cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" /> Approve & Payout
                    </button>
                    <button
                      id={`btn-decline-cashout-${req.id}`}
                      onClick={() => handleCashoutDecision(req.id, 'declined')}
                      disabled={loading}
                      className="px-4 py-2 bg-zinc-100 hover:bg-red-50 hover:text-red-700 text-zinc-600 rounded-lg text-xs font-bold transition-all focus:outline-none cursor-pointer"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Panel 3: TRADE-IN REVIEW */}
      {activeTab === 'tradeins' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-extrabold text-zinc-900 uppercase tracking-wider">Active Trade-In Inspections</h3>
            <p className="text-xs text-zinc-500 font-medium">Review vendor submitted cards and credit valuation. Confirm and authorize store credits.</p>
          </div>

          {pendingTradeIns.length === 0 ? (
            <div className="py-14 text-center bg-white border border-zinc-200 rounded-xl shadow-xs">
              <span className="text-xs text-zinc-400 font-bold">No trade-ins awaiting review</span>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingTradeIns.map((tr) => (
                <div key={tr.id} className="bg-white border border-zinc-200 rounded-xl p-5 shadow-xs space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="bg-blue-50 border border-blue-100 text-blue-700 text-[9px] font-extrabold px-2 py-0.5 rounded uppercase">
                        Trade ID: {tr.id}
                      </span>
                      <h4 className="text-sm font-black text-zinc-800 mt-1.5 font-bold">Submitted by {tr.vendorName}</h4>
                      <p className="text-[11px] text-zinc-400 font-semibold mt-1">Submitted: {new Date(tr.date).toLocaleDateString('en-GB')}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-zinc-400 block font-bold">Requested Stored Credit</span>
                      <span className="text-base font-black text-blue-600 block mt-0.5">£{tr.creditApplied.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="bg-zinc-50 rounded-lg p-4 border border-zinc-200 text-xs text-zinc-700 font-medium leading-relaxed">
                    <span className="font-bold text-zinc-400 block uppercase mb-1 text-[10px]">Trade-In details</span>
                    "{tr.details}"
                  </div>

                  {/* Decision footer */}
                  <div className="flex justify-between items-center pt-2">
                    <div className="text-[11px] text-zinc-400 font-semibold flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> Condition check recommended on Wed / Sat stall
                    </div>
                    
                    <div className="flex gap-2">
                      <button
                        id={`btn-approve-tradein-${tr.id}`}
                        onClick={() => handleTradeInDecision(tr.id, 'approved', tr.creditApplied)}
                        disabled={loading}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 focus:outline-none cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" /> Confirm & Credit Stored Value
                      </button>
                      <button
                        id={`btn-decline-tradein-${tr.id}`}
                        onClick={() => handleTradeInDecision(tr.id, 'declined', 0)}
                        disabled={loading}
                        className="px-4 py-2 bg-zinc-100 hover:bg-red-50 hover:text-red-700 text-zinc-600 rounded-lg text-xs font-bold transition-all focus:outline-none cursor-pointer"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Edit/Create Vendor Modal Dialog */}
      {(editingVendorId !== null || showCreateForm) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="bg-white rounded-xl shadow-lg border border-zinc-200 w-full max-w-sm overflow-hidden">
            <div className="p-5 border-b border-zinc-200 bg-zinc-50/50 flex justify-between items-center">
              <h4 className="text-xs font-black text-zinc-900 uppercase tracking-wider">
                {editingVendorId ? "Edit Vendor Structure" : "Register Stall Vendor"}
              </h4>
              <button
                onClick={() => {
                  setEditingVendorId(null);
                  setShowCreateForm(false);
                }}
                className="text-zinc-400 hover:text-zinc-600 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveVendor} className="p-6 space-y-4">
              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
                  Vendor Name / Alias
                </label>
                <input
                  id="admin-vendor-name"
                  type="text"
                  required
                  placeholder="e.g. Lavender Collectables"
                  value={vName}
                  onChange={(e) => setVName(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-600 text-xs rounded-lg py-2.5 px-3.5 outline-none font-bold text-zinc-700 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
                    Personal PIN
                  </label>
                  <input
                    id="admin-vendor-pin"
                    type="text"
                    required
                    maxLength={4}
                    placeholder="e.g. 5555"
                    value={vPin}
                    onChange={(e) => setVPin(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-200 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-600 text-xs rounded-lg py-2.5 px-3.5 outline-none font-bold text-zinc-700 tracking-wider text-center"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
                    Commission (%)
                  </label>
                  <input
                    id="admin-vendor-comm"
                    type="number"
                    required
                    min={0}
                    max={100}
                    placeholder="e.g. 10"
                    value={vComm}
                    onChange={(e) => setVComm(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-200 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-600 text-xs rounded-lg py-2.5 px-3.5 outline-none font-black text-zinc-700 text-center"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-200 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setEditingVendorId(null);
                    setShowCreateForm(false);
                  }}
                  className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 rounded-lg text-xs font-bold text-zinc-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="btn-admin-save-vendor"
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  {loading ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    "Save Vendor Structure"
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
