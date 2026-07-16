import React, { useState } from 'react';
import { ShoppingBag, Search, Plus, Check, CheckCircle2, RefreshCw, Sparkles, UserCheck } from 'lucide-react';
import { StockItem, Vendor, Sale } from '../types';

interface JointStaffPageProps {
  vendors: Vendor[];
  stock: StockItem[];
  sales: Sale[];
  onLogSale: (saleData: {
    vendorId: string;
    itemName: string;
    stockItemId: string | null;
    price: number;
    date: string;
  }) => Promise<void>;
}

export default function JointStaffPage({ vendors, stock, sales, onLogSale }: JointStaffPageProps) {
  // Local form state
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [selectedStockId, setSelectedStockId] = useState('');
  const [manualItemName, setManualItemName] = useState('');
  const [manualPrice, setManualPrice] = useState('');
  const [useStockItem, setUseStockItem] = useState(true);

  // Search filter for stock selection
  const [stockSearchQuery, setStockSearchQuery] = useState('');

  // Status state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Available in-stock items
  const availableStock = stock.filter(item => item.quantity > 0);

  // Filter stock based on search query
  const filteredStock = availableStock.filter(item => {
    const searchLower = stockSearchQuery.toLowerCase();
    const matchesQuery = item.name.toLowerCase().includes(searchLower) || 
                         (item.setName && item.setName.toLowerCase().includes(searchLower)) ||
                         (item.vendorName && item.vendorName.toLowerCase().includes(searchLower));
    
    // If a vendor is already selected, optionally restrict stock to that vendor
    const matchesVendor = selectedVendorId ? item.vendorId === selectedVendorId : true;
    
    return matchesQuery && matchesVendor;
  });

  const handleStockSelect = (itemId: string) => {
    const item = stock.find(s => s.id === itemId);
    if (item) {
      setSelectedStockId(itemId);
      setSelectedVendorId(item.vendorId);
      setManualItemName(item.name);
      setManualPrice(item.price.toString());
    } else {
      setSelectedStockId('');
      setManualItemName('');
      setManualPrice('');
    }
  };

  const handleToggleMode = (isStock: boolean) => {
    setUseStockItem(isStock);
    setSelectedStockId('');
    setSelectedVendorId('');
    setManualItemName('');
    setManualPrice('');
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
    if (!manualItemName.trim()) {
      setErrorMessage("Please enter an item name.");
      return;
    }
    if (!manualPrice || isNaN(Number(manualPrice)) || Number(manualPrice) <= 0) {
      setErrorMessage("Please enter a valid price greater than 0.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onLogSale({
        vendorId: selectedVendorId,
        itemName: manualItemName,
        stockItemId: useStockItem && selectedStockId ? selectedStockId : null,
        price: Number(manualPrice),
        date: new Date().toISOString()
      });

      // Show success
      const vendorName = vendors.find(v => v.id === selectedVendorId)?.name || 'Vendor';
      setSuccessMessage(`Successfully logged sale of "${manualItemName}" (£${Number(manualPrice).toFixed(2)}) for ${vendorName}!`);
      
      // Reset form
      setSelectedStockId('');
      setSelectedVendorId('');
      setManualItemName('');
      setManualPrice('');
      setStockSearchQuery('');

      // Auto-clear success message after 4 seconds
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to log sale.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter sales completed today for current display
  const now = new Date("2026-07-14T06:28:56-07:00");
  const todaySales = sales.filter((sale) => {
    const saleDate = new Date(sale.date);
    return (
      saleDate.getFullYear() === now.getFullYear() &&
      saleDate.getMonth() === now.getMonth() &&
      saleDate.getDate() === now.getDate()
    );
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Sales Logging Box (8 Cols on Desktop) */}
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

        {/* Tab Selector: From Stock vs Manual */}
        <div className="grid grid-cols-2 bg-zinc-100 p-1 rounded-lg mb-6">
          <button
            id="btn-register-stock"
            type="button"
            onClick={() => handleToggleMode(true)}
            className={`py-2 rounded-md text-xs font-bold transition-all ${
              useStockItem
                ? 'bg-white text-zinc-900 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-700'
            }`}
          >
            Select from Stock Item
          </button>
          <button
            id="btn-register-manual"
            type="button"
            onClick={() => handleToggleMode(false)}
            className={`py-2 rounded-md text-xs font-bold transition-all ${
              !useStockItem
                ? 'bg-white text-zinc-900 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-700'
            }`}
          >
            Manual Custom Entry
          </button>
        </div>

        {/* Error / Success Notifications */}
        {successMessage && (
          <div className="mb-6 bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-start gap-2.5 text-emerald-800 text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p>{successMessage}</p>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-xs font-semibold">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {useStockItem ? (
            <div className="space-y-4">
              {/* Stock Selector Search */}
              <div>
                <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider block mb-2">
                  Search & Select In-Stock Card / Item
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-3.5 w-4 h-4 text-zinc-400" />
                  <input
                    id="stock-search-input"
                    type="text"
                    placeholder="Search by card name, set, or vendor name..."
                    value={stockSearchQuery}
                    onChange={(e) => setStockSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 hover:border-zinc-300 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-600 text-sm rounded-lg outline-none font-medium transition-all"
                  />
                </div>

                {/* Scroller list of filtered stock */}
                <div className="mt-3 border border-zinc-200 rounded-lg max-h-48 overflow-y-auto divide-y divide-zinc-100 bg-zinc-50/50">
                  {filteredStock.length === 0 ? (
                    <div className="py-8 text-center text-xs text-zinc-400 font-medium">
                      No matching items in stock. Switch to "Manual Custom Entry" or adjust search.
                    </div>
                  ) : (
                    filteredStock.map((item) => (
                      <button
                        id={`stock-option-${item.id}`}
                        key={item.id}
                        type="button"
                        onClick={() => handleStockSelect(item.id)}
                        className={`w-full text-left px-4 py-3 flex justify-between items-center transition-colors ${
                          selectedStockId === item.id
                            ? 'bg-blue-50/50 hover:bg-blue-50 border-l-4 border-blue-600 rounded-r-lg rounded-l-none font-bold'
                            : 'hover:bg-zinc-100'
                        }`}
                      >
                        <div>
                          <span className="font-bold text-zinc-800 text-sm block">{item.name}</span>
                          <span className="text-[10px] text-zinc-400 font-bold block mt-0.5 uppercase">
                            {item.setName} • Owner: {item.vendorName}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-extrabold text-sm text-zinc-800 block">
                            £{item.price.toFixed(2)}
                          </span>
                          <span className="text-[10px] text-zinc-400 font-medium block">
                            Qty remaining: {item.quantity}
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Select Vendor */}
              <div>
                <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider block mb-2">
                  Select Item Owner (Vendor)
                </label>
                <select
                  id="select-vendor-manual"
                  value={selectedVendorId}
                  onChange={(e) => setSelectedVendorId(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 hover:border-zinc-300 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-600 text-sm rounded-lg py-2.5 px-4 outline-none font-semibold text-zinc-700 transition-all"
                >
                  <option value="">-- Choose Vendor --</option>
                  {vendors.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Manual Item Name */}
              <div>
                <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider block mb-2">
                  Custom Item Name
                </label>
                <input
                  id="manual-item-input"
                  type="text"
                  placeholder="e.g. Vintage Holo Bundle / Bulk Pack"
                  value={manualItemName}
                  onChange={(e) => setManualItemName(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 hover:border-zinc-300 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-600 text-sm rounded-lg py-2.5 px-4 outline-none font-medium transition-all"
                />
              </div>
            </div>
          )}

          {/* Locked-in Fields display or Price Form */}
          <div className="grid grid-cols-2 gap-4">
            {/* Price Field */}
            <div className="col-span-2 sm:col-span-1">
              <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider block mb-2">
                Sale Price (£)
              </label>
              <input
                id="manual-price-input"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={manualPrice}
                onChange={(e) => setManualPrice(e.target.value)}
                disabled={useStockItem && !!selectedStockId} // locked for pre-populated items, editable for manual
                className="w-full bg-zinc-50 border border-zinc-200 hover:border-zinc-300 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-600 text-sm rounded-lg py-2.5 px-4 outline-none font-extrabold text-zinc-900 disabled:bg-zinc-100 disabled:text-zinc-400 transition-all"
              />
              {useStockItem && selectedStockId && (
                <span className="text-[10px] text-zinc-400 font-medium block mt-1">
                  Price locked to inventory config
                </span>
              )}
            </div>

            {/* Vendor Display (If using Stock selection) */}
            {useStockItem && selectedStockId && (
              <div className="col-span-2 sm:col-span-1">
                <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider block mb-2">
                  Auto-Assigned Vendor
                </label>
                <div className="bg-zinc-100 border border-zinc-200 text-zinc-700 font-semibold text-sm rounded-lg py-2.5 px-4 flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-zinc-400" />
                  {vendors.find(v => v.id === selectedVendorId)?.name || 'Linked Owner'}
                </div>
              </div>
            )}
          </div>

          <button
            id="btn-submit-sale"
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-950 text-white rounded-lg text-xs font-bold tracking-wide shadow-xs transition-colors flex items-center justify-center gap-2 focus:outline-none disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Recording Register...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" /> Record Sale
              </>
            )}
          </button>
        </form>
      </div>

      {/* Live Stall Receipt Feed (5 Cols on Desktop) */}
      <div className="lg:col-span-5 bg-white rounded-xl border border-zinc-200 shadow-xs p-6 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-xs font-extrabold text-zinc-900 uppercase tracking-wider">Today's Transactions</h3>
              <p className="text-[11px] text-zinc-500 font-medium">Live receipts feed for {now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
            </div>
            <span className="text-xs font-bold text-zinc-600 bg-zinc-50 border border-zinc-200 px-2 py-0.5 rounded">
              {todaySales.length} Total
            </span>
          </div>

          <div className="space-y-3.5 max-h-[320px] overflow-y-auto pr-1">
            {todaySales.length === 0 ? (
              <div className="py-14 text-center bg-zinc-50 border border-dashed border-zinc-200 rounded-lg">
                <span className="text-xs text-zinc-400 font-semibold">No sales recorded today</span>
                <p className="text-[10px] text-zinc-400 mt-0.5">Use the register on the left to start</p>
              </div>
            ) : (
              todaySales.map((sale) => (
                <div
                  key={sale.id}
                  className="bg-zinc-50 border border-zinc-200 rounded-lg p-3.5 flex justify-between items-start hover:shadow-xs transition-shadow"
                >
                  <div className="space-y-0.5">
                    <span className="text-xs font-extrabold text-zinc-800 block truncate max-w-[150px]">
                      {sale.itemName}
                    </span>
                    <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block">
                      Owner: {sale.vendorName.split(' ')[0]}
                    </span>
                    <span className="text-[9px] font-medium text-zinc-400 block">
                      {new Date(sale.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-extrabold text-zinc-900 block">
                      £{sale.price.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))
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
    </div>
  );
}
