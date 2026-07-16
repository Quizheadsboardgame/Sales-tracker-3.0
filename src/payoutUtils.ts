/**
 * Utility functions for Newton's Collectables payout maturation calculations.
 * 
 * Rules:
 * - Payouts are done on a Friday.
 * - Wednesday sales are paid 16 days later (on Friday).
 * - Saturday sales are paid 13 days later (on Friday).
 * - General rule: sales on any other day are paid on the second Friday following the sale (14 + (5 - dayOfWeek) days).
 */

export function getPayoutDate(saleDateInput: string | Date): Date {
  const saleDate = new Date(saleDateInput);
  
  // getDay() returns 0 for Sunday, 1 for Monday, ..., 6 for Saturday
  const dayOfWeek = saleDate.getDay();
  
  // Calculate days to add to reach the second Friday (always lands on Friday, between 13 to 19 days later)
  const daysToAdd = 14 + (5 - dayOfWeek);
  
  const payoutDate = new Date(saleDate.getTime());
  payoutDate.setDate(payoutDate.getDate() + daysToAdd);
  
  // Set to the end of that day or keep time same
  return payoutDate;
}

export function isSaleMature(saleDateInput: string | Date, nowInput: Date = new Date()): boolean {
  const payoutDate = getPayoutDate(saleDateInput);
  
  // Strip hours/minutes/seconds for date-only comparison or do direct timestamp comparison.
  // Direct timestamp comparison or date-only comparison:
  // To be user friendly and exact, let's compare dates:
  const payoutDateCopy = new Date(payoutDate);
  payoutDateCopy.setHours(0, 0, 0, 0);
  
  const nowCopy = new Date(nowInput);
  nowCopy.setHours(0, 0, 0, 0);
  
  return nowCopy.getTime() >= payoutDateCopy.getTime();
}

export function getRemainingDays(saleDateInput: string | Date, nowInput: Date = new Date()): number {
  const payoutDate = getPayoutDate(saleDateInput);
  
  const payoutDateCopy = new Date(payoutDate);
  payoutDateCopy.setHours(0, 0, 0, 0);
  
  const nowCopy = new Date(nowInput);
  nowCopy.setHours(0, 0, 0, 0);
  
  const diffTime = payoutDateCopy.getTime() - nowCopy.getTime();
  if (diffTime <= 0) return 0;
  
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}
