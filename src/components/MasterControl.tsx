import React, { useState } from 'react';
import { ShieldCheck, Users, Percent, PercentIcon, DollarSign, Coins, TrendingUp, Check, X, RefreshCw, Edit2, Plus, Sparkles, AlertCircle, Search, Calendar, Trash2, Download, FileText } from 'lucide-react';
import { Vendor, Sale, CashoutRequest, TradeIn } from '../types';
import { isSaleMature, getRemainingDays } from '../payoutUtils';
import { downloadVendorClearedBalancePDF } from '../pdfUtils';

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
    color?: string;
  }) => Promise<void>;
  onRespondCashout: (cashoutId: string, status: 'approved' | 'declined') => Promise<void>;
  onRespondTradeIn: (tradeInId: string, status: 'approved' | 'declined', finalCredit?: number) => Promise<void>;
  onUpdateSale: (saleId: string, saleData: {
    vendorId: string;
    itemName: string;
    price: number;
    date: string;
  }) => Promise<void>;
  onDeleteSale: (saleId: string) => Promise<void>;
  onViewVendorProfile?: (vendorId: string) => void;
}

export default function MasterControl({
  vendors,
  sales,
  cashouts,
  tradeIns,
  onUpdateVendor,
  onRespondCashout,
  onRespondTradeIn,
  onUpdateSale,
  onDeleteSale,
  onViewVendorProfile
}: MasterControlProps) {
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

  // Tabs for Master Control
  const [activeTab, setActiveTab] = useState<'vendors' | 'cashouts' | 'tradeins' | 'sales' | 'backups'>('vendors');

  // Backups Management States
  const [backupsList, setBackupsList] = useState<{ filename: string; size: number; mtime: string }[]>([]);
  const [currentDbSize, setCurrentDbSize] = useState<number>(0);
  const [currentDbMtime, setCurrentDbMtime] = useState<string | null>(null);
  const [mirrorDbSize, setMirrorDbSize] = useState<number>(0);
  const [mirrorDbMtime, setMirrorDbMtime] = useState<string | null>(null);
  const [backupTabLoading, setBackupTabLoading] = useState(false);
  const [customBackupJson, setCustomBackupJson] = useState('');
  const [restoringFile, setRestoringFile] = useState<string | null>(null);

  const fetchBackups = async () => {
    setBackupTabLoading(true);
    try {
      const res = await fetch('/api/admin/backups');
      if (res.ok) {
        const data = await res.json();
        setBackupsList(data.backups || []);
        setCurrentDbSize(data.currentDbSize || 0);
        setCurrentDbMtime(data.currentDbMtime || null);
        setMirrorDbSize(data.mirrorDbSize || 0);
        setMirrorDbMtime(data.mirrorDbMtime || null);
      }
    } catch (err) {
      console.error("Error loading database backups:", err);
    } finally {
      setBackupTabLoading(false);
    }
  };

  React.useEffect(() => {
    if (activeTab === 'backups') {
      fetchBackups();
    }
  }, [activeTab]);

  const handleCreateBackup = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/admin/backups/create', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setSuccess(`Backup file successfully created: ${data.filename}`);
        fetchBackups();
      } else {
        const errData = await res.json();
        setError(errData.error || "Failed to create manual backup file.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to create manual backup file.");
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreBackup = async (filename: string) => {
    const confirmationMsg = filename === 'backup' 
      ? "Are you absolutely sure you want to restore from the mirror database backup (data.backup.json)?\n\nThis will completely restore your previous state and replace all currently loaded sales, stocks, and vendors."
      : `Are you absolutely sure you want to restore the entire database from "${filename}"?\n\nThis will replace all loaded data on all logged-in devices in real time!`;
      
    if (!window.confirm(confirmationMsg)) {
      return;
    }
    setRestoringFile(filename);
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/admin/backups/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename })
      });
      if (res.ok) {
        setSuccess(`Stall database state successfully restored from backup!`);
        fetchBackups();
      } else {
        const errData = await res.json();
        setError(errData.error || "Failed to restore database state.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to restore database state.");
    } finally {
      setLoading(false);
      setRestoringFile(null);
    }
  };

  const handleUploadBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customBackupJson.trim()) {
      setError("Please paste a valid JSON database backup payload first.");
      return;
    }
    if (!window.confirm("Warning: Restoring from uploaded custom JSON payload will overwrite all active data on all devices. Are you sure?")) {
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/admin/backups/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: customBackupJson })
      });
      if (res.ok) {
        setSuccess("Database successfully restored from custom JSON upload!");
        setCustomBackupJson('');
        fetchBackups();
      } else {
        const errData = await res.json();
        setError(errData.error || "Failed to parse or restore uploaded data.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to upload JSON backup payload.");
    } finally {
      setLoading(false);
    }
  };

  // Edit vendor modal form state
  const [editingVendorId, setEditingVendorId] = useState<string | null>(null);
  const [vName, setVName] = useState('');
  const [vPin, setVPin] = useState('');
  const [vComm, setVComm] = useState('');
  const [vColor, setVColor] = useState('#64748B');

  // Create new vendor state
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Edit/delete sale states & handlers
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);
  const [saleVendorId, setSaleVendorId] = useState('');
  const [saleItemName, setSaleItemName] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [saleDate, setSaleDate] = useState('');

  const [salesSearchQuery, setSalesSearchQuery] = useState('');
  const [salesFilterVendorId, setSalesFilterVendorId] = useState('');
  const [deletingSaleId, setDeletingSaleId] = useState<string | null>(null);

  // Filtered & sorted sales
  const filteredSales = sales
    .filter((sale) => {
      const matchSearch = sale.itemName.toLowerCase().includes(salesSearchQuery.toLowerCase()) ||
                          sale.vendorName.toLowerCase().includes(salesSearchQuery.toLowerCase());
      const matchVendor = salesFilterVendorId ? sale.vendorId === salesFilterVendorId : true;
      return matchSearch && matchVendor;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleStartEditSale = (sale: Sale) => {
    setEditingSaleId(sale.id);
    setSaleVendorId(sale.vendorId);
    setSaleItemName(sale.itemName);
    setSalePrice(sale.price.toString());
    
    // Format date properly for datetime-local (YYYY-MM-DDTHH:MM)
    const d = new Date(sale.date);
    const tzOffset = d.getTimezoneOffset() * 60000;
    const localISODate = new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
    setSaleDate(localISODate);
  };

  const handleSaveSale = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!saleVendorId || !saleItemName.trim() || !salePrice) {
      setError("Please fill out all fields.");
      return;
    }

    const priceNum = Number(salePrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      setError("Price must be a valid number greater than 0.");
      return;
    }

    setLoading(true);
    try {
      await onUpdateSale(editingSaleId || '', {
        vendorId: saleVendorId,
        itemName: saleItemName,
        price: priceNum,
        date: new Date(saleDate).toISOString()
      });

      setSuccess("Sale updated successfully!");
      setEditingSaleId(null);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to update sale.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSaleConfirm = async (saleId: string) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await onDeleteSale(saleId);
      setSuccess("Sale deleted successfully!");
      setDeletingSaleId(null);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to delete sale.");
    } finally {
      setLoading(false);
    }
  };

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
    setVColor(vendor.color || '#64748B');
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
        commission: Number((commPercent / 100).toFixed(4)),
        color: vColor
      });

      setSuccess("Vendor updated successfully!");
      setEditingVendorId(null);
      setVName('');
      setVPin('');
      setVComm('');
      setVColor('#64748B');
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
    setVColor('#64748B');
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
      <div className="flex border-b border-zinc-200 gap-6 overflow-x-auto">
        <button
          id="btn-admin-vendors"
          onClick={() => setActiveTab('vendors')}
          className={`pb-3 text-xs font-bold transition-all relative whitespace-nowrap focus:outline-none ${
            activeTab === 'vendors' ? 'text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'
          }`}
        >
          Vendor Structures ({vendors.length})
          {activeTab === 'vendors' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />}
        </button>
        <button
          id="btn-admin-cashouts"
          onClick={() => setActiveTab('cashouts')}
          className={`pb-3 text-xs font-bold transition-all relative whitespace-nowrap focus:outline-none ${
            activeTab === 'cashouts' ? 'text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'
          }`}
        >
          Payout Approvals ({pendingCashouts.length})
          {activeTab === 'cashouts' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />}
        </button>
        <button
          id="btn-admin-tradeins"
          onClick={() => setActiveTab('tradeins')}
          className={`pb-3 text-xs font-bold transition-all relative whitespace-nowrap focus:outline-none ${
            activeTab === 'tradeins' ? 'text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'
          }`}
        >
          Trade-In Verifications ({pendingTradeIns.length})
          {activeTab === 'tradeins' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />}
        </button>
        <button
          id="btn-admin-sales"
          onClick={() => setActiveTab('sales')}
          className={`pb-3 text-xs font-bold transition-all relative whitespace-nowrap focus:outline-none ${
            activeTab === 'sales' ? 'text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'
          }`}
        >
          Sales Ledger ({sales.length})
          {activeTab === 'sales' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />}
        </button>
        <button
          id="btn-admin-backups"
          onClick={() => setActiveTab('backups')}
          className={`pb-3 text-xs font-bold transition-all relative whitespace-nowrap focus:outline-none ${
            activeTab === 'backups' ? 'text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'
          }`}
        >
          Database & Backups 💾
          {activeTab === 'backups' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />}
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
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-3.5 h-3.5 rounded-full border border-black/10 shadow-xs shrink-0" style={{ backgroundColor: v.color || '#64748B' }} />
                    <span className="text-[10px] font-bold text-zinc-400 tracking-widest uppercase">
                      VENDOR ID: {v.id}
                    </span>
                  </div>
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

                <div className="flex flex-col gap-1.5 shrink-0 items-end">
                  <div className="flex items-center gap-1.5">
                    <button
                      id={`btn-pdf-vendor-${v.id}`}
                      onClick={() => downloadVendorClearedBalancePDF(v, sales, cashouts)}
                      className="p-2 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-blue-600 rounded-lg transition-all cursor-pointer flex items-center gap-1 text-[11px] font-bold"
                      title="Download Vendor Cleared Balance & Sales PDF Statement"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      id={`btn-edit-vendor-${v.id}`}
                      onClick={() => handleStartEdit(v)}
                      className="p-2 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-zinc-600 rounded-lg transition-all cursor-pointer"
                      title="Edit Vendor Configuration"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                  {onViewVendorProfile && (
                    <button
                      id={`btn-view-vendor-profile-${v.id}`}
                      onClick={() => onViewVendorProfile(v.id)}
                      className="px-2 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 font-bold text-[10px] rounded-lg transition-all cursor-pointer uppercase tracking-wider whitespace-nowrap"
                      title="View Vendor Dashboard & Stock without PIN login"
                    >
                      🔍 View Profile
                    </button>
                  )}
                </div>
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

      {/* Panel 4: SALES AUDIT LEDGER */}
      {activeTab === 'sales' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div>
              <h3 className="text-sm font-extrabold text-zinc-900 uppercase tracking-wider">Sales Audit Ledger</h3>
              <p className="text-xs text-zinc-500 font-medium">Audit registered sales, correct mistakes, update owner allocations, or remove invalid records</p>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 bg-zinc-50 p-4 border border-zinc-200 rounded-xl">
            {/* Search query */}
            <div>
              <label className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider block mb-1">Search Item / Vendor</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search item, vendor..."
                  value={salesSearchQuery}
                  onChange={(e) => setSalesSearchQuery(e.target.value)}
                  className="w-full bg-white pl-8 pr-3 border border-zinc-200 hover:border-zinc-300 text-xs rounded-lg py-2 outline-none font-medium text-zinc-700 transition-all"
                />
              </div>
            </div>

            {/* Vendor Filter */}
            <div>
              <label className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider block mb-1">Filter by Vendor</label>
              <select
                value={salesFilterVendorId}
                onChange={(e) => setSalesFilterVendorId(e.target.value)}
                className="w-full bg-white border border-zinc-200 hover:border-zinc-300 text-xs rounded-lg py-2 px-3 outline-none font-semibold text-zinc-700 transition-all"
              >
                <option value="">All Vendors</option>
                {vendors.map(v => (
                  <option key={v.id} value={v.id}>
                    {getVendorColorEmoji(v.color)} {v.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Total Results Counter */}
            <div className="flex items-end justify-start sm:justify-end pb-1.5 text-xs font-bold text-zinc-500">
              Showing {filteredSales.length} of {sales.length} sales
            </div>
          </div>

          {filteredSales.length === 0 ? (
            <div className="py-14 text-center bg-white border border-zinc-200 rounded-xl shadow-xs">
              <span className="text-xs text-zinc-400 font-bold">No sales match your search criteria</span>
            </div>
          ) : (
            <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-50 border-b border-zinc-200 text-[10px] font-black text-zinc-400 uppercase tracking-wider">
                      <th className="py-3 px-4">Date & Time</th>
                      <th className="py-3 px-4">Item Name</th>
                      <th className="py-3 px-4">Vendor Name</th>
                      <th className="py-3 px-4 text-right">Price (£)</th>
                      <th className="py-3 px-4 text-right">Commission</th>
                      <th className="py-3 px-4 text-right">Earnings</th>
                      <th className="py-3 px-4 text-center">Payout Maturity</th>
                      <th className="py-3 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 text-xs font-medium text-zinc-700">
                    {filteredSales.map((sale) => (
                      <tr key={sale.id} className="hover:bg-zinc-50/50 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-zinc-500">
                          {new Date(sale.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} at{' '}
                          {new Date(sale.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-3.5 px-4 font-extrabold text-zinc-800">{sale.itemName}</td>
                        <td className="py-3.5 px-4">
                          {(() => {
                            const vObj = vendors.find((v) => v.id === sale.vendorId);
                            const vColor = vObj?.color || '#64748B';
                            return (
                              <span 
                                className="inline-flex items-center gap-1.5 border px-2 py-0.5 rounded-full font-extrabold text-[10px]"
                                style={{
                                  backgroundColor: `${vColor}10`, // 10% opacity for soft bg
                                  borderColor: `${vColor}50`, // 50% opacity border
                                  color: vColor
                                }}
                              >
                                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: vColor }} />
                                {sale.vendorName}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="py-3.5 px-4 text-right font-black text-zinc-900">£{sale.price.toFixed(2)}</td>
                        <td className="py-3.5 px-4 text-right text-red-600 font-semibold">-£{sale.commissionAmount.toFixed(2)}</td>
                        <td className="py-3.5 px-4 text-right text-emerald-600 font-bold">£{sale.vendorEarnings.toFixed(2)}</td>
                        <td className="py-3.5 px-4 text-center">
                          {(() => {
                            const isMature = isSaleMature(sale.date);
                            const daysLeft = getRemainingDays(sale.date);
                            if (sale.cashedOut) {
                              return (
                                <span className="inline-flex items-center text-[9px] font-bold text-green-700 bg-green-50 border border-green-200/50 px-2 py-0.5 rounded">
                                  Paid Out
                                </span>
                              );
                            }
                            if (sale.cashoutRequestId) {
                              return (
                                <span className="inline-flex items-center text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200/50 px-2 py-0.5 rounded">
                                  Pending Cashout
                                </span>
                              );
                            }
                            if (isMature) {
                              return (
                                <span className="inline-flex items-center text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/50 px-2 py-0.5 rounded">
                                  Mature
                                </span>
                              );
                            }
                            return (
                              <span className="inline-flex items-center text-[9px] font-bold text-blue-700 bg-blue-50 border border-blue-200/50 px-2 py-0.5 rounded">
                                {daysLeft === 1 ? '1 day left' : `${daysLeft} days left`}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center justify-center gap-2">
                            {deletingSaleId === sale.id ? (
                              <div className="flex items-center gap-1 bg-red-50 border border-red-200 px-2 py-1 rounded-lg">
                                <span className="text-[10px] text-red-700 font-extrabold mr-1">Delete?</span>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSaleConfirm(sale.id)}
                                  className="px-2 py-0.5 bg-red-600 text-white rounded text-[9px] font-bold uppercase tracking-wider cursor-pointer"
                                >
                                  Yes
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeletingSaleId(null)}
                                  className="px-2 py-0.5 bg-zinc-200 text-zinc-700 rounded text-[9px] font-bold uppercase tracking-wider cursor-pointer"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleStartEditSale(sale)}
                                  className="p-1.5 hover:bg-zinc-100 border border-transparent hover:border-zinc-200 text-zinc-500 hover:text-zinc-800 rounded transition-all cursor-pointer"
                                  title="Edit Sale"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeletingSaleId(sale.id)}
                                  className="p-1.5 hover:bg-red-50 border border-transparent hover:border-red-100 text-zinc-400 hover:text-red-600 rounded transition-all cursor-pointer"
                                  title="Delete Sale"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Panel 5: DATABASE BACKUPS & REALTIME STORAGE */}
      {activeTab === 'backups' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-extrabold text-zinc-900 uppercase tracking-wider flex items-center gap-2">
              <span className="p-1 bg-zinc-100 rounded text-zinc-700">💾</span> Database & Backup Management
            </h3>
            <p className="text-xs text-zinc-500 font-medium mt-1">
              Automated system-mirror backups, rolling historical restore-points, and raw JSON utility tools. State updates are broadcasted to all active devices in real time.
            </p>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 space-y-1">
              <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block">Active Database (data.json)</span>
              <span className="text-base font-extrabold text-zinc-800 block">
                {currentDbSize ? `${(currentDbSize / 1024).toFixed(2)} KB` : '0.00 KB'}
              </span>
              <span className="text-[10px] text-zinc-400 font-semibold block mt-1">
                Last Write: {currentDbMtime ? new Date(currentDbMtime).toLocaleString('en-GB') : 'Never'}
              </span>
            </div>

            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 space-y-1">
              <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block">System-Mirror Backup (data.backup.json)</span>
              <span className="text-base font-extrabold text-emerald-600 block">
                {mirrorDbSize ? `${(mirrorDbSize / 1024).toFixed(2)} KB` : '0.00 KB'}
              </span>
              <span className="text-[10px] text-zinc-400 font-semibold block mt-1">
                Status: Safe & Synced
              </span>
            </div>

            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 space-y-1">
              <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block">Historical Restore Points</span>
              <span className="text-base font-extrabold text-blue-600 block">
                {backupsList.length} Saved Files
              </span>
              <span className="text-[10px] text-zinc-400 font-semibold block mt-1">
                Max Rotation limit: 15 files
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* List of Historical Backups & Restores */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex justify-between items-center bg-white border border-zinc-200 p-4 rounded-xl shadow-xs">
                <div>
                  <h4 className="text-xs font-black text-zinc-800 uppercase tracking-wider">Historical Restore Points</h4>
                  <p className="text-[10px] text-zinc-400 font-bold">Instantly rollback to any previous version</p>
                </div>
                <button
                  id="btn-trigger-backup"
                  onClick={handleCreateBackup}
                  disabled={loading || backupTabLoading}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-zinc-200 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Force Backup Now
                </button>
              </div>

              {backupTabLoading ? (
                <div className="py-12 text-center bg-white border border-zinc-200 rounded-xl">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto text-zinc-400" />
                  <p className="text-xs text-zinc-500 font-bold mt-2">Scanning backups directory...</p>
                </div>
              ) : (
                <div className="bg-white border border-zinc-200 rounded-xl shadow-xs overflow-hidden divide-y divide-zinc-200">
                  {/* System Mirror Quick Restore Block */}
                  <div className="p-4 bg-zinc-50/50 flex justify-between items-center text-xs">
                    <div>
                      <span className="text-[9px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded uppercase tracking-wider">
                        Immediate Mirror
                      </span>
                      <h5 className="font-extrabold text-zinc-800 mt-1">data.backup.json</h5>
                      <p className="text-[10px] text-zinc-400 font-semibold mt-0.5">
                        Dual-write safety mirror kept automatically in root
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <a
                        href="/api/admin/backups/download?file=backup"
                        download="data.backup.json"
                        className="px-2.5 py-1.5 bg-white hover:bg-zinc-50 text-zinc-700 border border-zinc-200 rounded text-[11px] font-bold transition-all cursor-pointer"
                      >
                        Download 📥
                      </a>
                      <button
                        onClick={() => handleRestoreBackup('backup')}
                        disabled={loading}
                        className="px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded text-[11px] font-bold transition-all cursor-pointer"
                      >
                        {restoringFile === 'backup' ? 'Restoring...' : 'Restore State ⚡'}
                      </button>
                    </div>
                  </div>

                  {/* Loop over historical backups */}
                  {backupsList.length === 0 ? (
                    <div className="p-8 text-center text-xs text-zinc-400 font-bold">
                      No timestamped backups exist yet. Make changes or click "Force Backup Now" to create one.
                    </div>
                  ) : (
                    backupsList.map((bk) => (
                      <div key={bk.filename} className="p-4 flex justify-between items-center text-xs">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="p-0.5 bg-zinc-100 text-zinc-600 rounded text-[9px] font-extrabold uppercase">
                              {bk.filename.includes('manual') ? 'Manual File' : 'Auto File'}
                            </span>
                            <span className="font-extrabold text-zinc-700 truncate max-w-[200px] sm:max-w-xs" title={bk.filename}>
                              {bk.filename}
                            </span>
                          </div>
                          <p className="text-[10px] text-zinc-400 font-medium">
                            Size: {(bk.size / 1024).toFixed(2)} KB • Date: {new Date(bk.mtime).toLocaleString('en-GB')}
                          </p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <a
                            href={`/api/admin/backups/download?file=${bk.filename}`}
                            download={bk.filename}
                            className="px-2.5 py-1.5 bg-white hover:bg-zinc-50 text-zinc-700 border border-zinc-200 rounded text-[11px] font-bold transition-all cursor-pointer"
                          >
                            Download 📥
                          </a>
                          <button
                            onClick={() => handleRestoreBackup(bk.filename)}
                            disabled={loading}
                            className="px-2.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded text-[11px] font-bold transition-all cursor-pointer"
                          >
                            {restoringFile === bk.filename ? 'Restoring...' : 'Restore'}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Custom JSON DB Overwrite tool */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-white border border-zinc-200 p-5 rounded-xl shadow-xs space-y-4">
                <div>
                  <h4 className="text-xs font-black text-zinc-900 uppercase tracking-wider">Raw JSON Database Utility</h4>
                  <p className="text-[10px] text-zinc-400 font-bold mt-0.5">Direct state export or live JSON overwriting</p>
                </div>

                <div className="space-y-2 text-xs font-semibold text-zinc-500">
                  <p>You can download the active database below, or overwrite the active state by pasting raw JSON code:</p>
                  <div className="flex gap-2">
                    <a
                      href="/api/admin/backups/download?file=current"
                      className="w-full text-center px-3 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-xs font-bold transition-all shadow-xs block"
                    >
                      Export Database file (data.json) 📥
                    </a>
                  </div>
                </div>

                <form onSubmit={handleUploadBackup} className="space-y-3">
                  <div>
                    <label className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider block mb-1">
                      Paste JSON Backup Payload to Overwrite
                    </label>
                    <textarea
                      placeholder='Pasted payload must contain {"vendors": [], "stock": [], "sales": [], ...} keys'
                      value={customBackupJson}
                      onChange={(e) => setCustomBackupJson(e.target.value)}
                      rows={6}
                      className="w-full bg-zinc-50 border border-zinc-200 hover:border-zinc-300 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-600 text-[11px] font-mono rounded-lg p-3 outline-none transition-all leading-normal"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !customBackupJson.trim()}
                    className="w-full py-2 bg-red-600 hover:bg-red-700 text-white disabled:bg-zinc-200 disabled:text-zinc-400 font-bold text-xs rounded-lg transition-all cursor-pointer shadow-xs"
                  >
                    Overwrite Database State ⚡
                  </button>
                </form>

                <div className="bg-amber-50 border border-amber-200/50 rounded-lg p-3 text-[10px] text-amber-800 font-semibold leading-relaxed">
                  ⚠️ WARNING: Overwriting active state immediately publishes updates to all connected devices in real-time. Make sure to download a copy of the database beforehand!
                </div>
              </div>
            </div>
          </div>
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

              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-2">
                  Vendor Theme Colour Swatch
                </label>
                <div className="flex flex-wrap gap-2 items-center bg-zinc-50 p-2.5 rounded-lg border border-zinc-200">
                  {[
                    { hex: '#64748B', name: 'Slate' },
                    { hex: '#EF4444', name: 'Red' },
                    { hex: '#F59E0B', name: 'Amber' },
                    { hex: '#FACC15', name: 'Yellow' },
                    { hex: '#10B981', name: 'Green' },
                    { hex: '#14B8A6', name: 'Teal' },
                    { hex: '#3B82F6', name: 'Blue' },
                    { hex: '#6366F1', name: 'Indigo' },
                    { hex: '#8B5CF6', name: 'Purple' },
                    { hex: '#EC4899', name: 'Pink' },
                    { hex: '#FFFFFF', name: 'White' },
                  ].map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setVColor(c.hex)}
                      className={`w-6 h-6 rounded-full cursor-pointer transition-all border-2 ${
                        vColor === c.hex 
                          ? 'border-zinc-900 scale-110 shadow-xs' 
                          : `${c.hex === '#FFFFFF' ? 'border-zinc-300' : 'border-transparent'} hover:scale-105`
                      }`}
                      style={{ backgroundColor: c.hex }}
                      title={c.name}
                    />
                  ))}
                  <div className="w-[1px] h-6 bg-zinc-200 mx-1" />
                  {/* Custom color picker */}
                  <div className="relative flex items-center justify-center w-6 h-6 rounded-full overflow-hidden border border-zinc-300 bg-white" title="Custom color picker">
                    <input
                      type="color"
                      value={vColor}
                      onChange={(e) => setVColor(e.target.value)}
                      className="absolute inset-0 w-8 h-8 -translate-x-1 -translate-y-1 cursor-pointer p-0 border-0"
                      title="Custom Color"
                    />
                  </div>
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

      {/* Edit Sale Modal Dialog */}
      {editingSaleId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="bg-white rounded-xl shadow-lg border border-zinc-200 w-full max-w-sm overflow-hidden">
            <div className="p-5 border-b border-zinc-200 bg-zinc-50/50 flex justify-between items-center">
              <h4 className="text-xs font-black text-zinc-900 uppercase tracking-wider">
                Edit Sale Transaction
              </h4>
              <button
                type="button"
                onClick={() => setEditingSaleId(null)}
                className="text-zinc-400 hover:text-zinc-600 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSale} className="p-6 space-y-4">
              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
                  Assign Item Owner (Vendor)
                </label>
                <select
                  required
                  value={saleVendorId}
                  onChange={(e) => setSaleVendorId(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-600 text-xs rounded-lg py-2.5 px-3.5 outline-none font-semibold text-zinc-700 transition-all"
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
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
                  Item Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Umbreon VMAX Alt Art"
                  value={saleItemName}
                  onChange={(e) => setSaleItemName(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-600 text-xs rounded-lg py-2.5 px-3.5 outline-none font-semibold text-zinc-700 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
                    Price (£)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={salePrice}
                    onChange={(e) => setSalePrice(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-200 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-600 text-xs rounded-lg py-2.5 px-3.5 outline-none font-black text-zinc-700 text-center"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
                    Transaction Date
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={saleDate}
                    onChange={(e) => setSaleDate(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-200 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-600 text-xs rounded-lg py-2.5 px-3.5 outline-none font-bold text-zinc-700 text-center"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-200 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setEditingSaleId(null)}
                  className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 rounded-lg text-xs font-bold text-zinc-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  {loading ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    "Save Transaction"
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
