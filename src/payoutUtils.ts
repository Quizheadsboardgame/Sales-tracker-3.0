/**
 * Utility functions for Newton's Collectables payout maturation calculations.
 * 
 * Rules:
 * - All sales mature 12 days after the sale date.
 */

export function getPayoutDate(saleDateInput: string | Date): Date {
  const saleDate = new Date(saleDateInput);
  // Normalize to start of local calendar day
  const normalizedSaleDate = new Date(saleDate.getFullYear(), saleDate.getMonth(), saleDate.getDate());
  const payoutDate = new Date(normalizedSaleDate);
  payoutDate.setDate(payoutDate.getDate() + 12);
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

