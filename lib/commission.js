// Commission Configuration
// Adjust these rates as your platform grows

export const COMMISSION_RATES = {
  FREE: 0.03,  // 3% platform commission
  PAID: 0.03,
};

/**
 * Payment gateway fee — absorbed by the platform, zero to creator.
 */
export function getPaymentGatewayFee(amount) {
  return 0;
}

/**
 * M-Pesa withdrawal fee based on official Safaricom 2025 agent withdrawal tiers.
 * Creators cover this fee when they withdraw earnings to M-Pesa.
 *
 * Tiers (KSh range → fee):
 *   50   – 100     → Free (0)
 *   101  – 500     → 11
 *   501  – 1,500   → 29
 *   1,501– 2,500   → 32
 *   2,501– 5,000   → 35
 *   5,001– 7,500   → 69
 *   7,501– 10,000  → 87
 *   10,001–15,000  → 115
 *   15,001–20,000  → 167
 *   20,001–35,000  → 185
 *   35,001–50,000  → 197
 *   50,001–250,000 → 309
 */
export function getTransferFee(amount) {
  if (amount <= 0)       return 0;
  if (amount <= 100)     return 0;
  if (amount <= 500)     return 11;
  if (amount <= 1500)    return 29;
  if (amount <= 2500)    return 32;
  if (amount <= 5000)    return 35;
  if (amount <= 7500)    return 69;
  if (amount <= 10000)   return 87;
  if (amount <= 15000)   return 115;
  if (amount <= 20000)   return 167;
  if (amount <= 35000)   return 185;
  if (amount <= 50000)   return 197;
  return 309; // up to 250,000
}

/**
 * Calculate platform commission and creator earnings.
 * @param {number} creatorPrice - The price set by the creator (KSh)
 * @param {string} plan - Creator's plan ('FREE' or 'PAID')
 * @param {number|null} customRate - Optional global commission override (decimal, e.g. 0.03 = 3%)
 * @returns {{ total, platformFee, paymentGatewayFee, transferFee, creatorEarnings, commissionRate, commissionPercent }}
 */
export function calculateCommission(creatorPrice, plan = 'FREE', customRate = null) {
  const platformRate = (customRate !== undefined && customRate !== null)
    ? customRate
    : (COMMISSION_RATES[plan] || COMMISSION_RATES.FREE);

  const platformFee       = Math.round(creatorPrice * platformRate);
  const paymentGatewayFee = getPaymentGatewayFee(creatorPrice);

  // Earnings after platform cut
  const baseEarnings  = creatorPrice - platformFee - paymentGatewayFee;

  // M-Pesa withdrawal fee is deducted from what the creator receives
  const transferFee    = getTransferFee(baseEarnings);
  const creatorEarnings = baseEarnings - transferFee;

  return {
    total: creatorPrice,
    platformFee,
    paymentGatewayFee,
    transferFee,
    commissionRate:    platformRate,
    commissionPercent: `${Math.round(platformRate * 100)}%`,
    creatorEarnings:   Math.max(0, creatorEarnings),
  };
}
