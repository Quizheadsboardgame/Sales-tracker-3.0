import React, { useState } from 'react';
import { Search, Plus, SlidersHorizontal, Image, Camera, RefreshCw, CheckCircle2, ChevronDown, Package } from 'lucide-react';
import { StockItem, Vendor } from '../types';

interface StockManagerProps {
  vendor: Vendor;
  stock: StockItem[];
  onAddStock: (stockData: {
    id?: string;
    name: string;
    price: number;
    vendorId: string;
    quantity: number;
    rarity: string;
    setName: string;
    imageUrl?: string;
  }) => Promise<void>;
  vendors?: Vendor[];
}

export default function StockManager({ vendor, stock, onAddStock, vendors }: StockManagerProps) {
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlyOwn, setShowOnlyOwn] = useState(false);

  // Form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemQty, setItemQty] = useState('1');
  const [itemSet, setItemSet] = useState('');
  const [itemRarity, setItemRarity] = useState('');
  const [imageBase64, setImageBase64] = useState('');

  // Status states
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Read uploaded file to base64
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setError("File is too large. Limit is 2MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!itemName.trim() || !itemPrice || !itemQty) {
      setError("Please fill out name, price, and quantity.");
      return;
    }

    const priceNum = Number(itemPrice);
    const qtyNum = Number(itemQty);

    if (isNaN(priceNum) || priceNum <= 0) {
      setError("Please enter a valid price.");
      return;
    }

    if (isNaN(qtyNum) || qtyNum < 1) {
      setError("Please enter a quantity of at least 1.");
      return;
    }

    setLoading(true);
    try {
      await onAddStock({
        name: itemName,
        price: priceNum,
        vendorId: vendor.id,
        quantity: qtyNum,
        setName: itemSet,
        rarity: itemRarity,
        imageUrl: imageBase64 || undefined
      });

      // Show success
      setSuccess(true);
      setItemName('');
      setItemPrice('');
      setItemQty('1');
      setItemSet('');
      setItemRarity('');
      setImageBase64('');
      
      // Close modal after brief timeout
      setTimeout(() => {
        setSuccess(false);
        setShowAddForm(false);
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Failed to add stock item.");
    } finally {
      setLoading(false);
    }
  };

  // Filter stock based on search
  const filteredStock = stock.filter((item) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      item.name.toLowerCase().includes(query) ||
      (item.setName && item.setName.toLowerCase().includes(query)) ||
      (item.rarity && item.rarity.toLowerCase().includes(query)) ||
      item.vendorName.toLowerCase().includes(query);

    const matchesOwn = showOnlyOwn ? item.vendorId === vendor.id : true;

    return matchesSearch && matchesOwn;
  });

  return (
    <div className="space-y-6">
      {/* Search and Action Bar in Geometric style */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-zinc-900 tracking-tight flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-600" />
            STALL STOCK CATALOG
          </h3>
          <p className="text-xs text-zinc-400 font-medium">Search the entire inventory of Newton's Collectables or register new cards</p>
        </div>
        <button
          id="btn-trigger-add-stock"
          onClick={() => setShowAddForm(true)}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 focus:outline-none"
        >
          <Plus className="w-4 h-4" /> Add Card/Stock
        </button>
      </div>

      {/* Filters & Search Control */}
      <div className="bg-white rounded-xl border border-zinc-200 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 w-4 h-4 text-zinc-400" />
          <input
            id="stock-catalog-search-input"
            type="text"
            placeholder="Search cards, expansions, rarity, or vendors..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 hover:border-zinc-300 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-600 text-xs rounded-lg outline-none font-semibold transition-all"
          />
        </div>

        {/* Filter checkbox/tabs */}
        <div className="flex items-center gap-1.5 bg-zinc-100 p-1 rounded-lg shrink-0">
          <button
            id="btn-filter-all-stock"
            type="button"
            onClick={() => setShowOnlyOwn(false)}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
              !showOnlyOwn ? 'bg-white text-zinc-900 border border-zinc-200/50 shadow-xs' : 'text-zinc-500 hover:text-zinc-900'
            }`}
          >
            All Vendors ({stock.length})
          </button>
          <button
            id="btn-filter-own-stock"
            type="button"
            onClick={() => setShowOnlyOwn(true)}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
              showOnlyOwn ? 'bg-white text-zinc-900 border border-zinc-200/50 shadow-xs' : 'text-zinc-500 hover:text-zinc-900'
            }`}
          >
            My Cards ({stock.filter((s) => s.vendorId === vendor.id).length})
          </button>
        </div>
      </div>

      {/* Add Stock Modal Form Dialog */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 p-4 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-xl shadow-xl border border-zinc-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-zinc-200 bg-zinc-50 flex justify-between items-center">
              <div>
                <h4 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">Add Card to Stall Stock</h4>
                <p className="text-[10px] text-zinc-400 font-semibold mt-0.5">Add to your active stock list. Staff can log sales from this instantly.</p>
              </div>
              <button
                id="btn-close-add-stock"
                onClick={() => setShowAddForm(false)}
                className="text-zinc-400 hover:text-zinc-600 text-xs font-bold bg-zinc-100 hover:bg-zinc-200 p-1.5 rounded"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-100 text-red-700 text-xs rounded-lg p-3 font-medium">
                  {error}
                </div>
              )}

              {success && (
                <div className="bg-green-50 border border-green-100 text-green-800 text-xs rounded-lg p-3 flex items-center gap-1.5 font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  Card registered successfully in stall inventory!
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {/* Name */}
                <div className="col-span-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
                    Card / Item Name
                  </label>
                  <input
                    id="add-stock-name"
                    type="text"
                    placeholder="e.g. Charizard ex Alt Art"
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    required
                    className="w-full bg-zinc-50 border border-zinc-200 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-600 text-xs rounded-lg py-2 px-3 outline-none font-semibold text-zinc-800 transition-all"
                  />
                </div>

                {/* Price */}
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
                    Price (£)
                  </label>
                  <input
                    id="add-stock-price"
                    type="number"
                    step="0.01"
                    placeholder="e.g. 150.00"
                    value={itemPrice}
                    onChange={(e) => setItemPrice(e.target.value)}
                    required
                    className="w-full bg-zinc-50 border border-zinc-200 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-600 text-xs rounded-lg py-2 px-3 outline-none font-bold text-zinc-900 transition-all"
                  />
                </div>

                {/* Quantity */}
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
                    Quantity
                  </label>
                  <input
                    id="add-stock-qty"
                    type="number"
                    min="1"
                    placeholder="1"
                    value={itemQty}
                    onChange={(e) => setItemQty(e.target.value)}
                    required
                    className="w-full bg-zinc-50 border border-zinc-200 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-600 text-xs rounded-lg py-2 px-3 outline-none font-semibold text-zinc-800 transition-all"
                  />
                </div>

                {/* Set/Expansion */}
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
                    Set / Expansion
                  </label>
                  <input
                    id="add-stock-set"
                    type="text"
                    placeholder="e.g. Obsidian Flames"
                    value={itemSet}
                    onChange={(e) => setItemSet(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-200 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-600 text-xs rounded-lg py-2 px-3 outline-none font-medium text-zinc-800 transition-all"
                  />
                </div>

                {/* Rarity */}
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
                    Rarity Tier
                  </label>
                  <input
                    id="add-stock-rarity"
                    type="text"
                    placeholder="e.g. Ultra Rare"
                    value={itemRarity}
                    onChange={(e) => setItemRarity(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-200 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-600 text-xs rounded-lg py-2 px-3 outline-none font-medium text-zinc-800 transition-all"
                  />
                </div>

                {/* Photo Upload capability */}
                <div className="col-span-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
                    Photo of Item
                  </label>
                  <div className="flex items-center gap-4">
                    <label className="flex flex-col items-center justify-center border border-dashed border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-500 h-20 w-20 rounded-lg cursor-pointer transition-colors relative">
                      {imageBase64 ? (
                        <img
                          src={imageBase64}
                          alt="preview"
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover rounded-lg"
                        />
                      ) : (
                        <>
                          <Camera className="w-5 h-5 text-zinc-400" />
                          <span className="text-[9px] font-semibold text-zinc-400 mt-1">Upload</span>
                        </>
                      )}
                      <input
                        id="add-stock-photo-file"
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="hidden"
                      />
                    </label>
                    <div className="text-xs text-zinc-400 space-y-0.5">
                      <p className="font-bold text-zinc-500">Provide an authentic card photo</p>
                      <p>Optional. Displayed during searches and peer trade negotiations.</p>
                      {imageBase64 && (
                        <button
                          type="button"
                          onClick={() => setImageBase64('')}
                          className="text-red-600 font-bold hover:underline"
                        >
                          Remove Photo
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-200 flex gap-3 justify-end">
                <button
                  id="btn-cancel-add-stock"
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg text-xs font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  id="btn-save-stock"
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-950 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Recording...
                    </>
                  ) : (
                    "Save to Inventory"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Grid of Inventory Cards */}
      {filteredStock.length === 0 ? (
        <div className="py-20 text-center bg-white border border-zinc-200 rounded-xl shadow-sm">
          <p className="text-sm font-semibold text-zinc-500">No stock matches found</p>
          <p className="text-xs text-zinc-400 mt-1">Try adjusting your filters or search terms</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredStock.map((item) => {
            const isOwn = item.vendorId === vendor.id;
            const itemVendorObj = vendors?.find(v => v.id === item.vendorId);
            const itemVendorColor = itemVendorObj?.color || (isOwn ? (vendor.color || '#2563EB') : '#64748B');
            return (
              <div
                key={item.id}
                className={`bg-white rounded-xl border transition-all hover:shadow-xs flex flex-col justify-between overflow-hidden ${
                  isOwn ? 'ring-1 bg-blue-50/5' : 'border-zinc-200'
                }`}
                style={isOwn ? { borderColor: `${itemVendorColor}50`, boxShadow: `0 0 10px ${itemVendorColor}08` } : undefined}
              >
                {/* Photo Header */}
                <div className="h-44 bg-zinc-50 relative flex items-center justify-center border-b border-zinc-200">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-zinc-300">
                      <Image className="w-10 h-10" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                        No Photo
                      </span>
                    </div>
                  )}

                  {/* Badges Overlay */}
                  <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                    {isOwn ? (
                      <span className="text-white font-extrabold text-[9px] px-2 py-0.5 rounded shadow-xs" style={{ backgroundColor: itemVendorColor }}>
                        My Card
                      </span>
                    ) : (
                      <span className="text-white font-extrabold text-[9px] px-2 py-0.5 rounded shadow-xs truncate max-w-[100px]" style={{ backgroundColor: itemVendorColor }}>
                        {item.vendorName.split(' ')[0]}'s Stall
                      </span>
                    )}

                    {item.quantity === 0 && (
                      <span className="bg-red-600 text-white font-bold text-[9px] px-2 py-0.5 rounded">
                        SOLD OUT
                      </span>
                    )}
                  </div>

                  {item.price && (
                    <div className="absolute bottom-3 right-3 bg-zinc-900/90 text-white font-bold text-xs px-2.5 py-1 rounded">
                      £{item.price.toFixed(2)}
                    </div>
                  )}
                </div>

                {/* Details Content */}
                <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                  <div>
                    <h5 className="font-bold text-zinc-900 text-sm leading-tight line-clamp-1">
                      {item.name}
                    </h5>
                    
                    <div className="flex justify-between items-center mt-1.5 text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                      <span>{item.setName || 'Unknown Set'}</span>
                      {item.rarity && (
                        <span className="text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.2 rounded font-bold">
                          {item.rarity}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-zinc-100 flex items-center justify-between text-xs font-bold">
                    <span className="text-zinc-400">Quantity</span>
                    <span className={item.quantity > 0 ? 'text-zinc-700' : 'text-red-500'}>
                      {item.quantity > 0 ? `${item.quantity} units` : 'Out of Stock'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
