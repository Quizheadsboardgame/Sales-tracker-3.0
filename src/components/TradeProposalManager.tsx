import React, { useState } from 'react';
import { ArrowLeftRight, Camera, Image, Check, X, RefreshCw, MessageSquare, Plus, Coins, Send } from 'lucide-react';
import { TradeProposal, Vendor, StockItem } from '../types';

interface TradeProposalManagerProps {
  vendor: Vendor;
  vendors: Vendor[];
  trades: TradeProposal[];
  onProposeTrade: (tradeData: {
    proposerId: string;
    receiverId: string;
    offeredItemNames: string;
    requestedItemNames: string;
    offeredCash: number;
    imageUrl?: string;
    notes?: string;
  }) => Promise<void>;
  onRespondTrade: (
    tradeId: string,
    status: 'accepted' | 'declined' | 'countered',
    responseDetails?: {
      notes?: string;
      counterOfferedItemNames?: string;
      counterRequestedItemNames?: string;
      counterOfferedCash?: number;
    }
  ) => Promise<void>;
}

export default function TradeProposalManager({
  vendor,
  vendors,
  trades,
  onProposeTrade,
  onRespondTrade
}: TradeProposalManagerProps) {
  // Navigation tabs for trades
  const [activeSubTab, setActiveSubTab] = useState<'incoming' | 'outgoing' | 'history'>('incoming');

  // Form states (Propose Trade Modal)
  const [showProposeModal, setShowProposeModal] = useState(false);
  const [selectedReceiverId, setSelectedReceiverId] = useState('');
  const [offeredItems, setOfferedItems] = useState('');
  const [requestedItems, setRequestedItems] = useState('');
  const [cashOffer, setCashOffer] = useState('0');
  const [notes, setNotes] = useState('');
  const [tradeImageBase64, setTradeImageBase64] = useState('');

  // Counter Offer form states (tied to a specific trade ID)
  const [counterTradeId, setCounterTradeId] = useState<string | null>(null);
  const [counterOfferedItems, setCounterOfferedItems] = useState('');
  const [counterRequestedItems, setCounterRequestedItems] = useState('');
  const [counterCashOffer, setCounterCashOffer] = useState('0');
  const [counterNotes, setCounterNotes] = useState('');

  // Loading/Success/Error states
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Read uploaded file to base64
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setErrorMsg("File is too large. Limit is 2MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setTradeImageBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Submit Trade Proposal
  const handleProposeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!selectedReceiverId) {
      setErrorMsg("Please select a vendor to trade with.");
      return;
    }
    if (!offeredItems.trim() || !requestedItems.trim()) {
      setErrorMsg("Please list offered and requested items.");
      return;
    }

    const cashNum = Number(cashOffer);
    if (isNaN(cashNum) || cashNum < 0) {
      setErrorMsg("Please enter a valid cash offer.");
      return;
    }

    if (cashNum > vendor.tradeCredit) {
      setErrorMsg(`Insufficient Trade Credit. You only have £${vendor.tradeCredit.toFixed(2)} in your site account.`);
      return;
    }

    setLoading(true);
    try {
      await onProposeTrade({
        proposerId: vendor.id,
        receiverId: selectedReceiverId,
        offeredItemNames: offeredItems,
        requestedItemNames: requestedItems,
        offeredCash: cashNum,
        imageUrl: tradeImageBase64 || undefined,
        notes: notes
      });

      setSuccessMsg("Trade proposal sent successfully!");
      // Reset
      setSelectedReceiverId('');
      setOfferedItems('');
      setRequestedItems('');
      setCashOffer('0');
      setNotes('');
      setTradeImageBase64('');

      setTimeout(() => {
        setSuccessMsg(null);
        setShowProposeModal(false);
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to propose trade.");
    } finally {
      setLoading(false);
    }
  };

  // Submit Counter Offer response
  const handleCounterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!counterTradeId) return;

    setErrorMsg(null);
    setLoading(true);
    try {
      await onRespondTrade(counterTradeId, 'countered', {
        notes: counterNotes,
        counterOfferedItemNames: counterOfferedItems,
        counterRequestedItemNames: counterRequestedItems,
        counterOfferedCash: Number(counterCashOffer)
      });

      setSuccessMsg("Counter offer submitted successfully!");
      setCounterTradeId(null);
      setCounterOfferedItems('');
      setCounterRequestedItems('');
      setCounterCashOffer('0');
      setCounterNotes('');

      setTimeout(() => setSuccessMsg(null), 2000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to submit counter offer.");
    } finally {
      setLoading(false);
    }
  };

  // Filter lists
  const incomingTrades = trades.filter((t) => t.receiverId === vendor.id && t.status === 'pending');
  const outgoingTrades = trades.filter((t) => t.proposerId === vendor.id && t.status === 'pending');
  const completedTrades = trades.filter((t) => 
    (t.proposerId === vendor.id || t.receiverId === vendor.id) && 
    (t.status === 'accepted' || t.status === 'declined' || t.status === 'countered')
  );

  const handleSimpleResponse = async (tradeId: string, status: 'accepted' | 'declined') => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      await onRespondTrade(tradeId, status);
      setSuccessMsg(`Trade proposal successfully ${status}!`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || "Action failed.");
    } finally {
      setLoading(false);
    }
  };

  const startCounter = (trade: TradeProposal) => {
    setCounterTradeId(trade.id);
    // Suggest inverted terms for counter
    setCounterOfferedItems(trade.requestedItemNames);
    setCounterRequestedItems(trade.offeredItemNames);
    setCounterCashOffer(trade.offeredCash.toString());
    setCounterNotes(`Counter proposal for previous offer. Let's balance the deal.`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-extrabold text-zinc-900 uppercase tracking-wider flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4 text-blue-600" />
            Peer-to-Peer Vendor Trading
          </h3>
          <p className="text-xs text-zinc-500 font-medium">Coordinate, negotiate, counter, and complete trades directly with other stall vendors</p>
        </div>
        <button
          id="btn-trigger-propose"
          onClick={() => setShowProposeModal(true)}
          className="px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 focus:outline-none cursor-pointer shadow-xs"
        >
          <Plus className="w-4 h-4" /> Propose New Trade
        </button>
      </div>

      {/* Global Notifications */}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg p-3.5 font-semibold">
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg p-3.5 font-semibold">
          {errorMsg}
        </div>
      )}

      {/* Sub Tabs */}
      <div className="flex border-b border-zinc-200 gap-6">
        <button
          id="btn-subtab-incoming"
          onClick={() => setActiveSubTab('incoming')}
          className={`pb-3 text-xs font-bold transition-all relative focus:outline-none ${
            activeSubTab === 'incoming' ? 'text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'
          }`}
        >
          Incoming Proposals ({incomingTrades.length})
          {activeSubTab === 'incoming' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />}
        </button>
        <button
          id="btn-subtab-outgoing"
          onClick={() => setActiveSubTab('outgoing')}
          className={`pb-3 text-xs font-bold transition-all relative focus:outline-none ${
            activeSubTab === 'outgoing' ? 'text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'
          }`}
        >
          Outgoing Offers ({outgoingTrades.length})
          {activeSubTab === 'outgoing' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />}
        </button>
        <button
          id="btn-subtab-history"
          onClick={() => setActiveSubTab('history')}
          className={`pb-3 text-xs font-bold transition-all relative focus:outline-none ${
            activeSubTab === 'history' ? 'text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'
          }`}
        >
          Negotiation Log ({completedTrades.length})
          {activeSubTab === 'history' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />}
        </button>
      </div>

      {/* Main Grid display depending on Active subtab */}
      <div className="space-y-4">
        {activeSubTab === 'incoming' && (
          incomingTrades.length === 0 ? (
            <div className="text-center py-16 bg-white border border-zinc-200 rounded-xl shadow-xs">
              <ArrowLeftRight className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-zinc-500">No pending incoming proposals</p>
              <p className="text-xs text-zinc-400 mt-1">Other vendors will propose card trades to you here</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {incomingTrades.map((trade) => (
                <div key={trade.id} className="bg-white rounded-xl border border-zinc-200 shadow-xs overflow-hidden flex flex-col justify-between">
                  {/* Photo of Items */}
                  {trade.imageUrl && (
                    <div className="h-44 bg-zinc-50 border-b border-zinc-200 relative">
                      <img
                        src={trade.imageUrl}
                        alt="Trade Items"
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover"
                      />
                      <span className="absolute top-2.5 right-2.5 bg-zinc-900/80 text-white font-bold text-[9px] px-2 py-0.5 rounded uppercase">
                        Card Photo Provided
                      </span>
                    </div>
                  )}

                  <div className="p-5 space-y-4 flex-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="bg-blue-50 border border-blue-100 text-blue-700 text-[9px] font-bold px-2 py-0.5 rounded">
                          From: {trade.proposerName}
                        </span>
                        <p className="text-[10px] text-zinc-400 font-semibold mt-1">
                          Received {new Date(trade.date).toLocaleDateString('en-GB')}
                        </p>
                      </div>
                      {trade.offeredCash > 0 && (
                        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 font-extrabold text-xs px-2.5 py-1 rounded flex items-center gap-1">
                          <Coins className="w-3.5 h-3.5" /> +£{trade.offeredCash.toFixed(2)}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-2">
                      <div className="bg-zinc-50 border border-zinc-100 rounded-lg p-3">
                        <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                          They Offer
                        </span>
                        <p className="text-xs font-extrabold text-zinc-700 line-clamp-3">
                          {trade.offeredItemNames}
                        </p>
                      </div>

                      <div className="bg-zinc-50 border border-zinc-100 rounded-lg p-3">
                        <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                          They Want From You
                        </span>
                        <p className="text-xs font-extrabold text-zinc-700 line-clamp-3">
                          {trade.requestedItemNames}
                        </p>
                      </div>
                    </div>

                    {trade.notes && (
                      <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex gap-2">
                        <MessageSquare className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-blue-800 font-medium">
                          "{trade.notes}"
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Actions footer */}
                  <div className="p-5 border-t border-zinc-200 bg-zinc-50/50 flex gap-2.5">
                    <button
                      id={`btn-accept-${trade.id}`}
                      onClick={() => handleSimpleResponse(trade.id, 'accepted')}
                      disabled={loading}
                      className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Check className="w-4 h-4" /> Accept Deal
                    </button>
                    <button
                      id={`btn-counter-${trade.id}`}
                      onClick={() => startCounter(trade)}
                      disabled={loading}
                      className="flex-1 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <ArrowLeftRight className="w-4 h-4" /> Counter Offer
                    </button>
                    <button
                      id={`btn-decline-${trade.id}`}
                      onClick={() => handleSimpleResponse(trade.id, 'declined')}
                      disabled={loading}
                      className="py-2 px-3 bg-zinc-100 hover:bg-red-50 hover:text-red-700 text-zinc-500 rounded-lg text-xs font-bold transition-colors flex items-center justify-center cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {activeSubTab === 'outgoing' && (
          outgoingTrades.length === 0 ? (
            <div className="text-center py-16 bg-white border border-zinc-200 rounded-xl shadow-xs">
              <ArrowLeftRight className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-zinc-500">No outgoing offers currently active</p>
              <p className="text-xs text-zinc-400 mt-1">Submit a new proposal to negotiate with other stall sellers</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {outgoingTrades.map((trade) => (
                <div key={trade.id} className="bg-white rounded-xl border border-zinc-200 shadow-xs overflow-hidden flex flex-col justify-between">
                  <div className="p-5 space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="bg-zinc-100 text-zinc-700 text-[9px] font-bold px-2 py-0.5 rounded">
                          Sent to: {trade.receiverName}
                        </span>
                        <p className="text-[10px] text-zinc-400 font-semibold mt-1">
                          Offered {new Date(trade.date).toLocaleDateString('en-GB')}
                        </p>
                      </div>
                      <span className="bg-amber-50 text-amber-800 text-[9px] font-bold px-2.5 py-1 rounded border border-amber-200 uppercase flex items-center gap-1">
                        <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Pending Response
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-zinc-50 border border-zinc-100 rounded-lg p-3">
                        <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                          Your Offer
                        </span>
                        <p className="text-xs font-bold text-zinc-700">
                          {trade.offeredItemNames}
                          {trade.offeredCash > 0 && ` + £${trade.offeredCash}`}
                        </p>
                      </div>

                      <div className="bg-zinc-50 border border-zinc-100 rounded-lg p-3">
                        <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                          Requested Item
                        </span>
                        <p className="text-xs font-bold text-zinc-700">
                          {trade.requestedItemNames}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {activeSubTab === 'history' && (
          completedTrades.length === 0 ? (
            <div className="text-center py-16 bg-white border border-zinc-200 rounded-xl shadow-xs">
              <p className="text-sm font-semibold text-zinc-500">No past negotiations registered</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-zinc-200 shadow-xs p-6 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                    <th className="pb-3">Deal Date</th>
                    <th className="pb-3">Trade Counterparties</th>
                    <th className="pb-3">Terms of Swap</th>
                    <th className="pb-3 text-right">Negotiation Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-xs">
                  {completedTrades.map((trade) => {
                    const isIncoming = trade.receiverId === vendor.id;
                    const counterpart = isIncoming ? trade.proposerName : trade.receiverName;

                    return (
                      <tr key={trade.id} className="hover:bg-zinc-50/50">
                        <td className="py-4 font-semibold text-zinc-500">
                          {new Date(trade.date).toLocaleDateString('en-GB')}
                        </td>
                        <td className="py-4">
                          <span className="font-extrabold text-zinc-800 block">
                            {isIncoming ? 'Incoming Swap' : 'Outgoing Swap'}
                          </span>
                          <span className="text-[10px] text-zinc-400 font-bold block uppercase mt-0.5">
                            With: {counterpart.split(' ')[0]}
                          </span>
                        </td>
                        <td className="py-4 pr-3 max-w-[220px]">
                          <span className="font-semibold text-zinc-600 block truncate">
                            Offered: {trade.offeredItemNames} {trade.offeredCash > 0 && `(+£${trade.offeredCash})`}
                          </span>
                          <span className="font-semibold text-zinc-400 block truncate">
                            Wanted: {trade.requestedItemNames}
                          </span>
                        </td>
                        <td className="py-4 text-right">
                          {trade.status === 'accepted' ? (
                            <span className="inline-flex items-center gap-1 text-[9px] font-extrabold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded uppercase">
                              Accepted Deal
                            </span>
                          ) : trade.status === 'declined' ? (
                            <span className="inline-flex items-center gap-1 text-[9px] font-extrabold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded uppercase">
                              Declined Swap
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[9px] font-extrabold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded uppercase">
                              Countered Deal
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* Counter Offer Modal Dialog */}
      {counterTradeId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-lg border border-zinc-200 w-full max-w-md overflow-hidden animate-in fade-in duration-100">
            <div className="p-5 border-b border-zinc-200 bg-zinc-50/50 flex justify-between items-center">
              <h4 className="text-xs font-black text-zinc-900 tracking-wider uppercase">Submit Counter Offer Swap</h4>
              <button onClick={() => setCounterTradeId(null)} className="text-zinc-400 hover:text-zinc-600 font-bold cursor-pointer">✕</button>
            </div>
            <form onSubmit={handleCounterSubmit} className="p-6 space-y-4">
              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">Items You Counter-Offer</label>
                <textarea
                  id="counter-offered-items"
                  value={counterOfferedItems}
                  onChange={(e) => setCounterOfferedItems(e.target.value)}
                  rows={2}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-3 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-600 font-medium"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">Items You Request In Swap</label>
                <textarea
                  id="counter-requested-items"
                  value={counterRequestedItems}
                  onChange={(e) => setCounterRequestedItems(e.target.value)}
                  rows={2}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-3 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-600 font-medium"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">Additional Cash Offered (£)</label>
                <input
                  id="counter-cash-offer"
                  type="number"
                  value={counterCashOffer}
                  onChange={(e) => setCounterCashOffer(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-600 text-xs rounded-lg py-2.5 px-3.5 outline-none font-bold text-zinc-700 transition-all"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">Explanation / Negotiation Notes</label>
                <textarea
                  id="counter-notes"
                  value={counterNotes}
                  onChange={(e) => setCounterNotes(e.target.value)}
                  rows={2}
                  placeholder="Tell them why you altered the swap terms..."
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-3 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-600 font-medium"
                />
              </div>

              <div className="pt-4 border-t border-zinc-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setCounterTradeId(null)}
                  className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 rounded-lg text-xs font-bold text-zinc-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="btn-counter-submit"
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" /> Submit Counter-Swap
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Propose Trade Modal Dialog */}
      {showProposeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-lg border border-zinc-200 w-full max-w-lg overflow-hidden animate-in fade-in duration-100">
            <div className="p-5 border-b border-zinc-200 bg-zinc-50/50 flex justify-between items-center">
              <div>
                <h4 className="text-xs font-black text-zinc-900 uppercase tracking-wider">Propose Cards Swap</h4>
                <p className="text-[11px] text-zinc-500 font-medium">Propose cards or money from your balance to another vendor</p>
              </div>
              <button onClick={() => setShowProposeModal(false)} className="text-zinc-400 hover:text-zinc-600 font-bold bg-zinc-100 p-1.5 rounded-full cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleProposeSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Receiver Vendor */}
              <div>
                <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">Target Vendor</label>
                <select
                  id="trade-propose-receiver"
                  value={selectedReceiverId}
                  onChange={(e) => setSelectedReceiverId(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-lg py-2.5 px-3.5 outline-none font-bold text-zinc-700 text-xs focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition-all"
                >
                  <option value="">-- Choose Vendor --</option>
                  {vendors.filter(v => v.id !== vendor.id).map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} (Credit Balance: £{v.tradeCredit.toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Offered items description */}
              <div>
                <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">What you are offering</label>
                <textarea
                  id="trade-propose-offered-items"
                  placeholder="e.g. 1x Rayquaza VMAX Alt Art (Evolving Skies)"
                  value={offeredItems}
                  onChange={(e) => setOfferedItems(e.target.value)}
                  rows={2}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-3 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-600 font-medium"
                />
              </div>

              {/* Additional cash offer */}
              <div>
                <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
                  Add Cash from Stored Balance (£)
                </label>
                <input
                  id="trade-propose-cash-offer"
                  type="number"
                  placeholder="0.00"
                  value={cashOffer}
                  onChange={(e) => setCashOffer(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-lg py-2.5 px-3.5 outline-none font-extrabold text-zinc-900 text-xs focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition-all"
                />
                <span className="text-[10px] text-zinc-400 font-semibold block mt-1">
                  Available in your account: £{vendor.tradeCredit.toFixed(2)}
                </span>
              </div>

              {/* Requested items description */}
              <div>
                <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">What you want from them</label>
                <textarea
                  id="trade-propose-requested-items"
                  placeholder="e.g. 1x Gengar VMAX Alt Art (Fusion Strike)"
                  value={requestedItems}
                  onChange={(e) => setRequestedItems(e.target.value)}
                  rows={2}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-3 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-600 font-medium"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">Message Note</label>
                <textarea
                  id="trade-propose-notes"
                  placeholder="Hi, misty! Swapping Rayquaza for Gengar. Adding £10 cash to sweeten the swap."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-3 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-600 font-medium"
                />
              </div>

              {/* Image Upload for trade proof/cards */}
              <div>
                <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">Upload Photo of trade items</label>
                <div className="flex items-center gap-4">
                  <label className="flex flex-col items-center justify-center border border-dashed border-zinc-300 bg-zinc-50 hover:bg-zinc-100 text-zinc-500 h-16 w-16 rounded-lg cursor-pointer transition-colors relative shrink-0">
                    {tradeImageBase64 ? (
                      <img src={tradeImageBase64} alt="upload preview" referrerPolicy="no-referrer" className="h-full w-full object-cover rounded-lg" />
                    ) : (
                      <>
                        <Camera className="w-5 h-5 text-zinc-400" />
                      </>
                    )}
                    <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                  </label>
                  <div className="text-[11px] text-zinc-400">
                    <p className="font-bold text-zinc-700">Provide card condition verification</p>
                    <p>Highly recommended to ensure a smooth, transparent exchange.</p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowProposeModal(false)}
                  className="px-4 py-2.5 bg-zinc-100 hover:bg-zinc-200 rounded-lg text-xs font-bold text-zinc-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="btn-propose-submit"
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Transmitting...
                    </>
                  ) : (
                    "Send Swap Proposal"
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
