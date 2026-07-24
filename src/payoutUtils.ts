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

