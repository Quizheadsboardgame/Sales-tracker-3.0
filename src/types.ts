export interface Vendor {
  id: string;
  name: string;
  pin: string;
  commission: number; // e.g. 0.10 for 10%
  tradeCredit: number; // accumulated credit stored in the site
  color?: string; // Hex color code
}

export interface StockItem {
  id: string;
  name: string;
  price: number;
  vendorId: string;
  vendorName: string;
  quantity: number;
  imageUrl?: string; // base64 or URL
  rarity?: string;
  setName?: string;
  dateAdded: string;
}

export interface Sale {
  id: string;
  vendorId: string;
  vendorName: string;
  itemName: string;
  stockItemId: string | null; // null if manual entry
  price: number; // total amount buyer paid
  commissionAmount: number; // Newton's share
  vendorEarnings: number; // vendor's share after commission
  date: string; // ISO string
  cashedOut: boolean;
  cashoutRequestId: string | null;
}

export interface TradeProposal {
  id: string;
  proposerId: string;
  proposerName: string;
  receiverId: string;
  receiverName: string;
  offeredItemNames: string; // text description or item names
  requestedItemNames: string; // text description or item names
  offeredCash: number; // additional cash offered
  imageUrl?: string; // Photo of items
  status: 'pending' | 'accepted' | 'declined' | 'countered';
  date: string;
  notes?: string;
}

export interface CashoutRequest {
  id: string;
  vendorId: string;
  vendorName: string;
  amount: number;
  date: string;
  status: 'pending' | 'approved' | 'declined';
  payoutDate?: string; // actual paid date
}

export interface TradeIn {
  id: string;
  vendorId: string;
  vendorName: string;
  details: string; // "Cards traded in: Charizard etc"
  estimatedValue: number;
  creditApplied: number; // agreed store credit
  status: 'pending' | 'approved' | 'declined';
  date: string;
}

export interface AppState {
  vendors: Vendor[];
  stock: StockItem[];
  sales: Sale[];
  trades: TradeProposal[];
  cashouts: CashoutRequest[];
  tradeIns: TradeIn[];
}
