import { Vendor, Sale, CashoutRequest } from './types';

/**
 * Utility functions for Newton's Collectables payout maturation calculations.
 * 
 * Rules:
 * - Newton's Collectables pays out on Fridays:
 * - Wednesday sales are paid 16 days later.
 * - Saturday sales are paid 13 days later.
 */

export function getPayoutDate(saleDateInput: string | Date): Date {
  const saleDate = new Date(saleDateInput);
  // Normalize to start of local calendar day
  const normalizedSaleDate = new Date(saleDate.getFullYear(), saleDate.getMonth(), saleDate.getDate());
  const day = normalizedSaleDate.getDay(); // 0 = Sun, 1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri, 6 = Sat

  let holdDays = 14;
  if (day === 3) {
    // Wednesday market sale -> paid 16 days later on Friday
    holdDays = 16;
  } else if (day === 6) {
    // Saturday market sale -> paid 13 days later on Friday
    holdDays = 13;
  } else if (day === 0) {
    holdDays = 12;
  } else if (day === 1) {
    holdDays = 18;
  } else if (day === 2) {
    holdDays = 17;
  } else if (day === 4) {
    holdDays = 15;
  } else if (day === 5) {
    holdDays = 14;
  }

  const payoutDate = new Date(normalizedSaleDate);
  payoutDate.setDate(payoutDate.getDate() + holdDays);
  return payoutDate;
}

export function isSaleMature(saleDateInput: string | Date, nowInput: Date = new Date()): boolean {
  const payoutDate = getPayoutDate(saleDateInput);
  const nowNormalized = new Date(nowInput.getFullYear(), nowInput.getMonth(), nowInput.getDate());
  
  return nowNormalized.getTime() >= payoutDate.getTime();
}

export function getRemainingDays(saleDateInput: string | Date, nowInput: Date = new Date()): number {
  const payoutDate = getPayoutDate(saleDateInput);
  const nowNormalized = new Date(nowInput.getFullYear(), nowInput.getMonth(), nowInput.getDate());
  
  const diffTime = payoutDate.getTime() - nowNormalized.getTime();
  if (diffTime <= 0) return 0;
  
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

export function getTimeLeftFormatted(saleDateInput: string | Date, nowInput: Date = new Date()): string {
  const remainingDays = getRemainingDays(saleDateInput, nowInput);
  if (remainingDays <= 0) {
    return 'Mature';
  }
  if (remainingDays === 1) {
    return '1 day left';
  }
  return `${remainingDays} days left`;
}

export interface VendorBalanceSummary {
  rawClearFunds: number;        // Uncashed mature sales earnings
  rawPendingFunds: number;      // Uncashed non-mature sales earnings
  tradeCredit: number;          // Raw vendor.tradeCredit
  spentOnTradeIns: number;      // Total spent on trade-ins if tradeCredit < 0
  availableCash: number;        // Cleared funds available for cashout after deducting trade-in expenses
  pendingCash: number;          // Pending funds remaining after deducting any leftover trade-in expenses
  netTradeCredit: number;       // Positive trade credit remaining
  netOwed: number;              // Amount vendor owes if trade-ins exceed clear + pending funds
  pendingCashoutsAmount: number;// Amount in pending cashout requests
  consolidatedBalance: number;  // Net overall balance
}

/**
 * Calculates accurate vendor balances incorporating trade-in deductions.
 * If tradeCredit < 0 (spent on trade-ins), trade-in expense reduces available cleared funds first,
 * then pending funds, preventing cashouts of funds that have already been spent on trade-ins.
 */
export function calculateVendorBalances(
  vendor: Vendor,
  sales: Sale[],
  cashouts: CashoutRequest[] = [],
  now: Date = new Date()
): VendorBalanceSummary {
  const vendorSales = sales.filter((s) => s.vendorId === vendor.id);
  
  let rawClearFunds = 0;
  let rawPendingFunds = 0;

  vendorSales.forEach((sale) => {
    if (sale.cashedOut) {
      // Already paid out
    } else if (sale.cashoutRequestId) {
      // Tagged in a pending/approved cashout request
    } else {
      if (isSaleMature(sale.date, now)) {
        rawClearFunds += sale.vendorEarnings;
      } else {
        rawPendingFunds += sale.vendorEarnings;
      }
    }
  });

  const vendorCashouts = cashouts.filter((c) => c.vendorId === vendor.id);
  const pendingCashoutsAmount = vendorCashouts
    .filter((c) => c.status === 'pending')
    .reduce((sum, c) => sum + c.amount, 0);

  const tradeCreditVal = vendor.tradeCredit || 0;
  let availableCash = 0;
  let pendingCash = 0;
  let netTradeCredit = 0;
  let netOwed = 0;
  let spentOnTradeIns = 0;

  if (tradeCreditVal < 0) {
    spentOnTradeIns = Math.abs(tradeCreditVal);
    // Trade-in expenses reduce clear funds first
    availableCash = Math.max(0, rawClearFunds - spentOnTradeIns);
    const remainingTradeExpense = Math.max(0, spentOnTradeIns - rawClearFunds);
    // Leftover trade-in expense reduces pending funds next
    pendingCash = Math.max(0, rawPendingFunds - remainingTradeExpense);
    // Remaining debt if trade-ins spent exceed clear + pending funds
    netOwed = Math.max(0, remainingTradeExpense - rawPendingFunds);
    netTradeCredit = 0;
  } else {
    spentOnTradeIns = 0;
    availableCash = rawClearFunds;
    pendingCash = rawPendingFunds;
    netTradeCredit = tradeCreditVal;
    netOwed = 0;
  }

  const consolidatedBalance = availableCash + pendingCash + netTradeCredit - netOwed + pendingCashoutsAmount;

  return {
    rawClearFunds,
    rawPendingFunds,
    tradeCredit: tradeCreditVal,
    spentOnTradeIns,
    availableCash,
    pendingCash,
    netTradeCredit,
    netOwed,
    pendingCashoutsAmount,
    consolidatedBalance
  };
}


