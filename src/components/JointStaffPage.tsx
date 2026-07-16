import React, { useState, useEffect } from 'react';
import { ShoppingBag, Search, Plus, Check, CheckCircle2, RefreshCw, Sparkles, UserCheck, Calendar, Trash2, Edit2, X } from 'lucide-react';
import { StockItem, Vendor, Sale, CashoutRequest, TradeIn } from '../types';
import { isSaleMature } from '../payoutUtils';

interface JointStaffPageProps {
  vendors: Vendor[];
  stock: StockItem[];
  sales: Sale[];
  cashouts: CashoutRequest[];
  tradeIns: TradeIn[];
  onLogSale: (saleData: {
    vendorId: string;
    itemName?: string;
    stockItemId?: string | null;
    price?: number;
    date: string;
    items?: Array<{
      itemName: string;
      stockItemId: string | null;
      price: number;
    }>;
    tradeIn?: {
      details: string;
      amount: number;
    };
  }) => Promise<void>;
  userRole?: string | null;
  adminViewingVendorId?: string | null;
  onViewVendorProfile?: (vendorId: string) => void;
  onUpdateSale?: (saleId: string, saleData: {
    vendorId: string;
    itemName: string;
    price: number;
    date: string;
  }) => Promise<void>;
  onDeleteSale?: (saleId: string) => Promise<void>;
}

export default function JointStaffPage({ 
  vendors, 
  stock, 
  sales, 
  cashouts,
  tradeIns,
  onLogSale,
  userRole,
  adminViewingVendorId,
  onViewVendorProfile,
  onUpdateSale,
  onDeleteSale
}: JointStaffPageProps) {
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

  // Helper functions to get current local date-times
  const getLocalNowString = () => {
    const d = new Date();
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
  };

  const getLocalDateOnlyString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Local form state
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [selectedStockId, setSelectedStockId] = useState('');
  const [manualItemName, setManualItemName] = useState('');
  const [manualPrice, setManualPrice] = useState('');

  // Trade-In state variables
  const [includeTradeIn, setIncludeTradeIn] = useState(false);
  const [tradeInDetails, setTradeInDetails] = useState('');
  const [tradeInAmount, setTradeInAmount] = useState('');

  // Approval state variables
  const [approvalPin, setApprovalPin] = useState('');
  const [owenApproved, setOwenApproved] = useState(false);
  const [pinErrorMsg, setPinErrorMsg] = useState<string | null>(null);

  // Reset approval states when vendor or trade-in setup is modified
  useEffect(() => {
    setApprovalPin('');
    setOwenApproved(false);
    setPinErrorMsg(null);
  }, [selectedVendorId, includeTradeIn]);

  // Helper to calculate consolidated balance for any vendor ID
  const calculateConsolidatedBalance = (vendorId: string): number => {
    const vendor = vendors.find(v => v.id === vendorId);
    if (!vendor) return 0;

    const vendorSales = sales.filter((s) => s.vendorId === vendorId);
    
    let availableCash = 0;
    let pendingCash = 0;
    const now = new Date();

    vendorSales.forEach((sale) => {
      if (sale.cashedOut) {
        // fully paid, not in balance
      } else if (sale.cashoutRequestId) {
        // If it has a cashout request (pending or approved but not cleared), it's not available
      } else {
        if (isSaleMature(sale.date, now)) {
          availableCash += sale.vendorEarnings;
        } else {
          pendingCash += sale.vendorEarnings;
        }
      }
    });

    const vendorCashouts = cashouts ? cashouts.filter((c) => c.vendorId === vendorId) : [];
    const pendingCashoutsAmount = vendorCashouts
      .filter((c) => c.status === 'pending')
      .reduce((sum, c) => sum + c.amount, 0);

    return availableCash + pendingCash + (vendor.tradeCredit || 0) + pendingCashoutsAmount;
  };

  // Multiple items state (Sale Basket)
  const [saleItems, setSaleItems] = useState<Array<{
    id: string;
    itemName: string;
    stockItemId: string | null;
    price: number;
  }>>([]);

  // Date/time controls defaulting to today's date and time (auto-sync)
  const [customDate, setCustomDate] = useState(() => getLocalNowString());

  // Today's transaction filter date defaulting to today's date
  const [filterDate, setFilterDate] = useState(() => getLocalDateOnlyString());

  // Status state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // States for Editing/Deleting Feed Transactions (Admin Staff Control Only)
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);
  const [deletingSaleId, setDeletingSaleId] = useState<string | null>(null);
  const [saleVendorId, setSaleVendorId] = useState('');
  const [saleItemName, setSaleItemName] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [saleDate, setSaleDate] = useState('');
  const [isSaveEditing, setIsSaveEditing] = useState(false);

  // Get active stock for the selected vendor, sorted alphabetically by name
  const vendorStockSorted = selectedVendorId
    ? stock
        .filter(item => item.vendorId === selectedVendorId && item.quantity > 0)
        .sort((a, b) => a.name.localeCompare(b.name))
    : [];

  const handleVendorChange = (vendorId: string) => {
    setSelectedVendorId(vendorId);
    setSelectedStockId('');
    setManualItemName('');
    setManualPrice('');
    setSaleItems([]); // Clear any multi-items when switching vendors
    setIncludeTradeIn(false);
    setTradeInDetails('');
    setTradeInAmount('');
  };

  const handleStockSelect = (itemId: string) => {
    if (itemId === 'custom') {
      setSelectedStockId('custom');
      setManualItemName('');
      setManualPrice('');
    } else if (itemId) {
      const item = stock.find(s => s.id === itemId);
      if (item) {
        setSelectedStockId(itemId);
        setManualItemName(item.name);
        setManualPrice(item.price.toString());
      }
    } else {
      setSelectedStockId('');
      setManualItemName('');
      setManualPrice('');
    }
  };

  const handleAddItem = () => {
    if (!selectedVendorId) {
      setErrorMessage("Please select a vendor first.");
      return;
    }
    if (!manualItemName.trim()) {
      setErrorMessage("Please select or enter a valid item name first.");
      return;
    }
    if (!manualPrice || isNaN(Number(manualPrice)) || Number(manualPrice) <= 0) {
      setErrorMessage("Please enter a valid price greater than 0 first.");
      return;
    }

    const newItem = {
      id: "item_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      itemName: manualItemName.trim(),
      stockItemId: (selectedStockId && selectedStockId !== 'custom') ? selectedStockId : null,
      price: Number(manualPrice)
    };

    setSaleItems([...saleItems, newItem]);
    setErrorMessage(null);

    // Reset current item selections (retains selectedVendorId)
    setSelectedStockId('');
    setManualItemName('');
    setManualPrice('');
  };

  const handleRemoveItem = (itemId: string) => {
    setSaleItems(saleItems.filter(item => item.id !== itemId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // Validations
    if (!selectedVendorId) {
      setErrorMessage("Please select a vendor.");
      return;
    }

    // Build the final array of items to process
    const itemsToSubmit = saleItems.map(item => ({
      itemName: item.itemName,
      stockItemId: item.stockItemId,
      price: item.price
    }));

    // If there is currently a valid item filled out in the input fields, automatically include it!
    const currentInputValid = manualItemName.trim() && manualPrice && !isNaN(Number(manualPrice)) && Number(manualPrice) > 0;

    if (currentInputValid) {
      itemsToSubmit.push({
        itemName: manualItemName.trim(),
        stockItemId: (selectedStockId && selectedStockId !== 'custom') ? selectedStockId : null,
        price: Number(manualPrice)
      });
    }

    // Validate trade-in if included
    let tradeInPayload = undefined;
    if (includeTradeIn) {
      if (!tradeInDetails.trim()) {
        setErrorMessage("Please enter details/cards for the trade-in.");
        return;
      }
      const tradeAmountNum = Number(tradeInAmount);
      if (isNaN(tradeAmountNum) || tradeAmountNum <= 0) {
        setErrorMessage("Please enter a valid trade-in amount greater than 0.");
        return;
      }
      tradeInPayload = {
        details: tradeInDetails.trim(),
        amount: tradeAmountNum
      };
    }

    // Must have either sale items or a trade-in
    if (itemsToSubmit.length === 0 && !tradeInPayload) {
      setErrorMessage("Please add at least one item to the sale, complete the fields, or include a trade-in.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onLogSale({
        vendorId: selectedVendorId,
        items: itemsToSubmit,
        date: new Date(customDate).toISOString(),
        tradeIn: tradeInPayload
      });

      // Show success
      const vendorName = vendors.find(v => v.id === selectedVendorId)?.name || 'Vendor';
      const totalAmount = itemsToSubmit.reduce((sum, item) => sum + item.price, 0);
      const tradeInText = tradeInPayload 
        ? ` (Traded-in: "${tradeInPayload.details}" for £${tradeInPayload.amount.toFixed(2)} - deducted from account)`
        : '';

      if (itemsToSubmit.length > 0) {
        setSuccessMessage(
          itemsToSubmit.length > 1
            ? `Successfully logged sale of ${itemsToSubmit.length} items (Total: £${totalAmount.toFixed(2)})${tradeInText} for ${vendorName}!`
            : `Successfully logged sale of "${itemsToSubmit[0].itemName}" (£${itemsToSubmit[0].price.toFixed(2)})${tradeInText} for ${vendorName}!`
        );
      } else if (tradeInPayload) {
        setSuccessMessage(`Successfully logged trade-in of "${tradeInPayload.details}" for £${tradeInPayload.amount.toFixed(2)} (deducted from ${vendorName}'s account)!`);
      }
      
      // Reset form and auto sync date to today's date & time
      setSelectedStockId('');
      setSelectedVendorId('');
      setManualItemName('');
      setManualPrice('');
      setSaleItems([]);
      setIncludeTradeIn(false);
      setTradeInDetails('');
      setTradeInAmount('');
      setCustomDate(getLocalNowString());

      // Auto-clear success message after 4 seconds
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to log sale.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEditSale = (sale: Sale) => {
    setEditingSaleId(sale.id);
    setSaleVendorId(sale.vendorId);
    setSaleItemName(sale.itemName);
    setSalePrice(sale.price.toString());
    
    const d = new Date(sale.date);
    const tzOffset = d.getTimezoneOffset() * 60000;
    const localISO = new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
    setSaleDate(localISO);
  };

  const handleSaveSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSaleId || !onUpdateSale) return;
    setIsSaveEditing(true);
    setErrorMessage(null);
    try {
      await onUpdateSale(editingSaleId, {
        vendorId: saleVendorId,
        itemName: saleItemName,
        price: Number(salePrice),
        date: new Date(saleDate).toISOString()
      });
      setSuccessMessage("Transaction updated successfully!");
      setEditingSaleId(null);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to update transaction.");
    } finally {
      setIsSaveEditing(false);
    }
  };

  const handleDeleteSaleConfirm = async (saleId: string) => {
    if (!onDeleteSale) return;
    setErrorMessage(null);
    try {
      await onDeleteSale(saleId);
      setSuccessMessage("Transaction deleted successfully!");
      setDeletingSaleId(null);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to delete transaction.");
    }
  };

  // Filter sales completed on selected filterDate for current display
  const selectedDateObj = new Date(filterDate);
  const todaySales = sales.filter((sale) => {
    const saleDate = new Date(sale.date);
    return (
      saleDate.getFullYear() === selectedDateObj.getFullYear() &&
      saleDate.getMonth() === selectedDateObj.getMonth() &&
      saleDate.getDate() === selectedDateObj.getDate()
    );
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Calculate real-time stats for the submit button
  const currentPriceNum = Number(manualPrice) || 0;
  const isCurrentInputFilled = manualItemName.trim() && currentPriceNum > 0;
  const totalItemsCount = saleItems.length + (isCurrentInputFilled ? 1 : 0);
  const totalPriceVal = saleItems.reduce((sum, item) => sum + item.price, 0) + (isCurrentInputFilled ? currentPriceNum : 0);
  const tradeInAmountNum = includeTradeIn ? (Number(tradeInAmount) || 0) : 0;
  const netPriceVal = totalPriceVal - tradeInAmountNum;

  const selectedVendorBalance = selectedVendorId ? calculateConsolidatedBalance(selectedVendorId) : 0;
  const enteredTradeInAmount = Number(tradeInAmount) || 0;
  const willBeNegative = includeTradeIn && enteredTradeInAmount > 0 && (selectedVendorBalance - enteredTradeInAmount < 0);

  const handleApprovalPinChange = (val: string) => {
    setApprovalPin(val);
    if (val === '9999') {
      setOwenApproved(true);
      setPinErrorMsg(null);
    } else {
      setOwenApproved(false);
      if (val.length === 4) {
        setPinErrorMsg('Incorrect pin.');
      } else {
        setPinErrorMsg(null);
      }
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Sales Logging Box (7 Cols on Desktop) */}
      <div className="lg:col-span-7 bg-white rounded-xl border border-zinc-200 shadow-xs p-6">
        <div className="flex items-center gap-2 mb-6">
          <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-zinc-900 uppercase tracking-wider">Joint Stall Register</h3>
            <p className="text-[11px] text-zinc-500 font-medium">Log active sales on behalf of any vendor present at Newton's Collectables</p>
          </div>
        </div>

        {/* Error / Success Notifications */}
        {successMessage && (
          <div className="mb-6 bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-start gap-2.5 text-emerald-800 text-xs font-semibold animate-in fade-in slide-in-from-top-1 duration-150">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p>{successMessage}</p>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-xs font-semibold animate-in fade-in slide-in-from-top-1 duration-150">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* STEP 1: SELECT VENDOR */}
          <div>
            <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider block mb-2">
              1. Select Vendor / Stall Owner First
            </label>
            <select
              id="select-vendor"
              value={selectedVendorId}
              onChange={(e) => handleVendorChange(e.target.value)}
              className="w-full bg-zinc-50 border border-zinc-200 hover:border-zinc-300 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-600 text-sm rounded-lg py-2.5 px-4 outline-none font-semibold text-zinc-700 transition-all cursor-pointer"
            >
              <option value="">-- Choose Vendor --</option>
              {vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {getVendorColorEmoji(vendor.color)} {vendor.name}
                </option>
              ))}
            </select>
            {selectedVendorId && (
              <div className="mt-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-zinc-50 p-2.5 rounded-lg border border-zinc-200 animate-in fade-in slide-in-from-top-1 duration-150">
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 rounded-full border border-black/15 shadow-xs shrink-0" style={{ backgroundColor: vendors.find(v => v.id === selectedVendorId)?.color || '#64748B' }} />
                  <span className="text-[11px] font-bold text-zinc-500">
                    Stall Theme Color: <span className="text-zinc-800">{vendors.find(v => v.id === selectedVendorId)?.name}</span>
                  </span>
                </div>
                {userRole === 'admin' && onViewVendorProfile && (
                  <button
                    type="button"
                    onClick={() => onViewVendorProfile(selectedVendorId)}
                    className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 font-bold text-[10px] rounded transition-all cursor-pointer uppercase tracking-wider self-start sm:self-auto"
                    title="Unlock and view this vendor's full profile & dashboard"
                  >
                    🔍 View Vendor Profile
                  </button>
                )}
              </div>
            )}
          </div>

          {/* STEP 2: SELECT OR ENTER CARD NAME */}
          <div>
            <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider block mb-2">
              2. Select Card / Item Name
            </label>
            {!selectedVendorId ? (
              <div className="bg-zinc-100 border border-zinc-200 text-zinc-400 text-xs font-medium py-3 px-4 rounded-lg">
                ⚠️ Please select a vendor first to see their stock or log a sale.
              </div>
            ) : (
              <div className="space-y-3">
                {/* If the vendor has added stock, show them in a drop down alphabetically */}
                {vendorStockSorted.length > 0 ? (
                  <div className="space-y-2.5">
                    <select
                      id="select-stock-card"
                      value={selectedStockId}
                      onChange={(e) => handleStockSelect(e.target.value)}
                      className="w-full bg-zinc-50 border border-zinc-200 hover:border-zinc-300 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-600 text-sm rounded-lg py-2.5 px-4 outline-none font-semibold text-zinc-700 transition-all cursor-pointer"
                    >
                      <option value="">-- Select In-Stock Card (Alphabetical) --</option>
                      {vendorStockSorted.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} ({item.setName || 'No Set'}) - £{item.price.toFixed(2)} (Qty: {item.quantity})
                        </option>
                      ))}
                      <option value="custom">✍️ Custom Manual Entry (Not in Stock Catalog)</option>
                    </select>

                    {/* Show item name text input if custom selected or default manual placeholder */}
                    {(selectedStockId === 'custom' || !selectedStockId) && (
                      <div className="space-y-1">
                        <input
                          id="manual-item-input"
                          type="text"
                          placeholder="Enter custom card name..."
                          value={manualItemName}
                          onChange={(e) => setManualItemName(e.target.value)}
                          className="w-full bg-zinc-50 border border-zinc-200 hover:border-zinc-300 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-600 text-sm rounded-lg py-2.5 px-4 outline-none font-medium transition-all animate-in fade-in slide-in-from-top-1 duration-150"
                        />
                        <span className="text-[10px] text-zinc-400 font-medium block">
                          Typing custom item name on behalf of {vendors.find(v => v.id === selectedVendorId)?.name}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  /* If vendor has no stock, show custom item text input directly */
                  <div className="space-y-1">
                    <input
                      id="manual-item-input-direct"
                      type="text"
                      placeholder="Enter custom card name..."
                      value={manualItemName}
                      onChange={(e) => setManualItemName(e.target.value)}
                      className="w-full bg-zinc-50 border border-zinc-200 hover:border-zinc-300 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-600 text-sm rounded-lg py-2.5 px-4 outline-none font-medium transition-all"
                    />
                    <span className="text-[10px] text-zinc-400 font-medium block">
                      This vendor has no catalog stock. Enter a custom card name.
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* STEP 3: PRICE & DATE FIELDS */}
          <div className="grid grid-cols-2 gap-4">
            {/* Price Field */}
            <div className="col-span-2 sm:col-span-1">
              <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider block mb-2">
                3. Sale Price (£)
              </label>
              <input
                id="manual-price-input"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={manualPrice}
                onChange={(e) => setManualPrice(e.target.value)}
                disabled={!selectedVendorId}
                className="w-full bg-zinc-50 border border-zinc-200 hover:border-zinc-300 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-600 text-sm rounded-lg py-2.5 px-4 outline-none font-extrabold text-zinc-900 disabled:bg-zinc-100 disabled:text-zinc-400 transition-all"
              />
              {selectedStockId && selectedStockId !== 'custom' && (
                <span className="text-[10px] text-zinc-400 font-medium block mt-1">
                  Pre-populated from stock (editable)
                </span>
              )}
            </div>

            {/* Auto-Assigned Vendor Display */}
            <div className="col-span-2 sm:col-span-1">
              <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider block mb-2">
                Linked Vendor Stall
              </label>
              <div className="bg-zinc-100 border border-zinc-200 text-zinc-700 font-semibold text-sm rounded-lg py-2.5 px-4 flex items-center gap-1.5 min-h-[42px]">
                <UserCheck className="w-4 h-4 text-zinc-400" />
                {vendors.find(v => v.id === selectedVendorId)?.name || '(Select Vendor First)'}
              </div>
            </div>

            {/* Add Item Trigger */}
            <div className="col-span-2">
              <button
                id="btn-add-item-to-basket"
                type="button"
                disabled={!selectedVendorId || !manualItemName.trim() || !manualPrice || isNaN(Number(manualPrice)) || Number(manualPrice) <= 0}
                onClick={handleAddItem}
                className="w-full py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 disabled:opacity-40 disabled:hover:bg-zinc-100 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer border border-zinc-200/50"
              >
                <Plus className="w-4 h-4" /> ＋ Add Item to Current Sale Basket
              </button>
            </div>

            {/* Custom Date Field with Auto-Sync */}
            <div className="col-span-2 pt-2">
              <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider block mb-2">
                Transaction Date & Time (Auto-Synced)
              </label>
              <div className="relative">
                <Calendar className="absolute left-3.5 top-3.5 w-4.5 h-4.5 text-zinc-400" />
                <input
                  id="custom-sale-date"
                  type="datetime-local"
                  required
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 hover:border-zinc-300 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-600 text-sm rounded-lg outline-none font-bold text-zinc-700 transition-all"
                />
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[10px] text-zinc-400 font-semibold block leading-relaxed">
                  Date is automatically synced to today but can be amended if needed.
                </span>
                <button
                  type="button"
                  onClick={() => setCustomDate(getLocalNowString())}
                  className="text-[10px] text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" /> Reset to Now
                </button>
              </div>
            </div>
          </div>

          {/* Current Sale items Basket listing */}
          {saleItems.length > 0 && (
            <div className="border border-zinc-200 rounded-xl p-4 bg-zinc-50/50 space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-200">
                <span className="text-xs font-extrabold text-zinc-700 uppercase tracking-wider">
                  Current Sale Basket ({saleItems.length})
                </span>
                <button
                  type="button"
                  onClick={() => setSaleItems([])}
                  className="text-[10px] text-red-600 hover:text-red-700 font-bold cursor-pointer"
                >
                  Clear Basket
                </button>
              </div>

              <div className="divide-y divide-zinc-200 max-h-48 overflow-y-auto pr-1">
                {saleItems.map((item) => (
                  <div key={item.id} className="py-2.5 flex items-center justify-between text-xs animate-in fade-in duration-100">
                    <div className="space-y-0.5 pr-2">
                      <span className="font-bold text-zinc-800 block truncate max-w-[280px]">
                        {item.itemName}
                      </span>
                      {item.stockItemId && (
                        <span className="text-[9px] text-blue-600 font-bold uppercase tracking-wider block">
                          Catalog Stock Item
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-extrabold text-zinc-900">£{item.price.toFixed(2)}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.id)}
                        className="p-1 text-zinc-400 hover:text-red-600 rounded-md transition-colors cursor-pointer"
                        title="Remove Item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-zinc-200 flex justify-between items-center">
                <span className="text-xs font-bold text-zinc-500">Basket Subtotal:</span>
                <span className="text-sm font-black text-zinc-900">
                  £{saleItems.reduce((sum, item) => sum + item.price, 0).toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {/* Customer Trade-In Section */}
          <div className="border border-zinc-200 rounded-xl p-4 bg-zinc-50/50 space-y-3">
            <div className="flex items-center justify-between">
              <label htmlFor="checkbox-include-trade-in" className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  id="checkbox-include-trade-in"
                  type="checkbox"
                  disabled={!selectedVendorId}
                  checked={includeTradeIn}
                  onChange={(e) => setIncludeTradeIn(e.target.checked)}
                  className="rounded border-zinc-300 text-zinc-800 focus:ring-zinc-500 w-4 h-4 cursor-pointer disabled:opacity-50"
                />
                <span className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
                  Include Customer Trade-In
                </span>
              </label>
              {includeTradeIn && (
                <span className="text-[10px] bg-red-50 text-red-600 font-extrabold px-2 py-0.5 rounded border border-red-100/50 uppercase tracking-wider">
                  Deducts from account balance
                </span>
              )}
            </div>

            {includeTradeIn && (
              <div className="space-y-3 pt-3 border-t border-zinc-200/60 animate-in fade-in duration-200">
                <div className="space-y-1">
                  <label htmlFor="trade-in-cards-input" className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider block">
                    Traded-In Cards & details
                  </label>
                  <input
                    id="trade-in-cards-input"
                    type="text"
                    required
                    placeholder="e.g. Charizard Base Set, 3x Pikachu V"
                    value={tradeInDetails}
                    onChange={(e) => setTradeInDetails(e.target.value)}
                    className="w-full bg-white border border-zinc-200 hover:border-zinc-300 focus:ring-2 focus:ring-blue-100 focus:border-blue-600 text-xs rounded-lg py-2.5 px-3 outline-none font-medium transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="trade-in-value-input" className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider block">
                    Total Trade-In Value (£)
                  </label>
                  <input
                    id="trade-in-value-input"
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={tradeInAmount}
                    onChange={(e) => setTradeInAmount(e.target.value)}
                    className="w-full bg-white border border-zinc-200 hover:border-zinc-300 focus:ring-2 focus:ring-blue-100 focus:border-blue-600 text-xs rounded-lg py-2.5 px-3 outline-none font-bold text-zinc-900 transition-all"
                  />
                  {selectedVendorId && (
                    <span className="text-[9px] text-zinc-500 font-bold block mt-1.5">
                      ⚠️ Deducts from {vendors.find(v => v.id === selectedVendorId)?.name}'s trade credit balance.
                    </span>
                  )}

                  {includeTradeIn && selectedVendorId && selectedVendorBalance < 100 && !willBeNegative && (
                    <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg p-3.5 mt-3 space-y-1 animate-in fade-in duration-200">
                      <p className="font-extrabold text-amber-950 flex items-center gap-1">
                        ⚠️ Balance Low
                      </p>
                      <p>
                        This vendor's consolidated stall balance is low: <strong className="font-extrabold text-amber-950">£{selectedVendorBalance.toFixed(2)}</strong>.
                      </p>
                    </div>
                  )}

                  {willBeNegative && (
                    <div className="bg-red-50 border border-red-200 text-red-800 text-xs rounded-lg p-4 mt-3 space-y-3 animate-in fade-in duration-200">
                      <div className="space-y-1">
                        <p className="font-extrabold text-red-950 uppercase tracking-wider flex items-center gap-1">
                          ⚠️ Owen's Approval Required
                        </p>
                        <p>
                          This trade-in will put the vendor's consolidated stall balance into negative: <strong className="font-extrabold text-red-950">£{(selectedVendorBalance - enteredTradeInAmount).toFixed(2)}</strong>. Current consolidated balance: <strong>£{selectedVendorBalance.toFixed(2)}</strong>.
                        </p>
                      </div>

                      {!owenApproved ? (
                        <div className="space-y-2 pt-2 border-t border-red-200/60">
                          <label className="text-[10px] font-extrabold text-red-900 uppercase tracking-widest block">
                            Enter Stall Controls PIN to Approve
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="password"
                              placeholder="••••"
                              maxLength={4}
                              value={approvalPin}
                              onChange={(e) => handleApprovalPinChange(e.target.value)}
                              className="bg-white border border-red-300 focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-600 text-xs font-black tracking-widest text-center rounded-lg py-2 px-3 w-28"
                            />
                            {pinErrorMsg && (
                              <span className="text-[10px] text-red-700 font-extrabold self-center">
                                {pinErrorMsg}
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 bg-green-50 border border-green-200 text-green-800 px-3 py-2 rounded-lg text-xs font-bold animate-in zoom-in-95 duration-150">
                          <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                          Owen's Approval Granted!
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            id="btn-submit-sale"
            type="submit"
            disabled={isSubmitting || !selectedVendorId || (totalItemsCount === 0 && (!includeTradeIn || !tradeInAmount || isNaN(Number(tradeInAmount)) || Number(tradeInAmount) <= 0)) || (willBeNegative && !owenApproved)}
            className="w-full py-3 bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-950 text-white rounded-lg text-xs font-bold tracking-wide shadow-xs transition-colors flex items-center justify-center gap-2 focus:outline-none disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Recording Register...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                {totalItemsCount > 0 && tradeInAmountNum > 0 ? (
                  `Record Sale & Trade-In (Net: £${netPriceVal.toFixed(2)} • Traded-In: -£${tradeInAmountNum.toFixed(2)})`
                ) : tradeInAmountNum > 0 ? (
                  `Record Trade-In Deduction (-£${tradeInAmountNum.toFixed(2)})`
                ) : totalItemsCount > 1 ? (
                  `Record Joint Sale (${totalItemsCount} Items • Total: £${totalPriceVal.toFixed(2)})`
                ) : (
                  `Record Sale (1 Item • Total: £${totalPriceVal.toFixed(2)})`
                )}
              </>
            )}
          </button>
        </form>
      </div>

      {/* Live Stall Receipt Feed (5 Cols on Desktop) */}
      <div className="lg:col-span-5 bg-white rounded-xl border border-zinc-200 shadow-xs p-6 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-xs font-extrabold text-zinc-900 uppercase tracking-wider">Date-Controlled Feed</h3>
              <p className="text-[11px] text-zinc-500 font-medium">Receipts for {selectedDateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
            </div>
            <span className="text-xs font-bold text-zinc-600 bg-zinc-50 border border-zinc-200 px-2 py-0.5 rounded">
              {todaySales.length} Total
            </span>
          </div>

          {/* Quick Date-controlled memory switcher */}
          <div className="mb-5 bg-zinc-50 border border-zinc-200 p-3 rounded-lg">
            <label className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider block mb-1">Switch Feed View Date</label>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-full bg-white border border-zinc-200 focus:border-blue-600 text-xs rounded-lg py-1.5 px-3 outline-none font-bold text-zinc-700 transition-all cursor-pointer"
            />
          </div>

          <div className="space-y-3.5 max-h-[320px] overflow-y-auto pr-1">
            {todaySales.length === 0 ? (
              <div className="py-14 text-center bg-zinc-50 border border-dashed border-zinc-200 rounded-lg">
                <span className="text-xs text-zinc-400 font-semibold">No sales recorded today</span>
                <p className="text-[10px] text-zinc-400 mt-0.5">Use the register on the left to start</p>
              </div>
            ) : (
              todaySales.map((sale) => {
                const vendorObj = vendors.find(v => v.id === sale.vendorId);
                const vendorColor = vendorObj?.color || '#64748B';
                return (
                  <div
                    key={sale.id}
                    className="bg-zinc-50 border border-zinc-200 rounded-lg p-3.5 flex justify-between items-start hover:shadow-xs transition-shadow"
                    style={{ borderLeft: `4px solid ${vendorColor}` }}
                  >
                    <div className="space-y-0.5">
                      <span className="text-xs font-extrabold text-zinc-800 block truncate max-w-[150px]">
                        {sale.itemName}
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-[9px] font-bold text-zinc-500 uppercase tracking-wider block mt-0.5">
                        <span className="w-2 h-2 rounded-full border border-black/10 shrink-0" style={{ backgroundColor: vendorColor }} />
                        Owner: {sale.vendorName.split(' ')[0]}
                      </span>
                      <span className="text-[9px] font-medium text-zinc-400 block pt-0.5">
                        {new Date(sale.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="text-right flex flex-col items-end gap-1.5">
                      <span className="text-sm font-extrabold text-zinc-900 block">
                        £{sale.price.toFixed(2)}
                      </span>
                      
                      {userRole === 'admin' && (
                        <div className="flex items-center gap-1 mt-1">
                          {deletingSaleId === sale.id ? (
                            <div className="flex items-center gap-1 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">
                              <span className="text-[9px] text-red-700 font-extrabold mr-1">Delete?</span>
                              <button
                                type="button"
                                onClick={() => handleDeleteSaleConfirm(sale.id)}
                                className="px-1.5 py-0.5 bg-red-600 text-white rounded text-[8px] font-bold uppercase tracking-wider cursor-pointer"
                              >
                                Yes
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingSaleId(null)}
                                className="px-1.5 py-0.5 bg-zinc-200 text-zinc-700 rounded text-[8px] font-bold uppercase tracking-wider cursor-pointer"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => handleStartEditSale(sale)}
                                className="p-1 hover:bg-zinc-250 border border-zinc-200 text-zinc-500 hover:text-zinc-800 rounded transition-all cursor-pointer"
                                title="Edit Sale"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingSaleId(sale.id)}
                                className="p-1 hover:bg-red-50 border border-zinc-200 text-zinc-400 hover:text-red-600 rounded transition-all cursor-pointer"
                                title="Delete Sale"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Dynamic total block at bottom */}
        {todaySales.length > 0 && (
          <div className="mt-6 pt-4 border-t border-dashed border-zinc-200 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-zinc-500">Today's Gross Total:</span>
              <span className="font-extrabold text-zinc-800">
                £{todaySales.reduce((acc, s) => acc + s.price, 0).toFixed(2)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Edit Sale Modal Dialog */}
      {editingSaleId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="bg-white rounded-xl shadow-lg border border-zinc-200 w-full max-w-sm overflow-hidden text-left">
            <div className="p-5 border-b border-zinc-200 bg-zinc-50/50 flex justify-between items-center">
              <h4 className="text-xs font-black text-zinc-900 uppercase tracking-wider">
                Edit Register Transaction
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
                  disabled={isSaveEditing}
                  className="px-5 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  {isSaveEditing ? (
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
