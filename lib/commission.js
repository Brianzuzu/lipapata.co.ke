// Commission Configuration
// Adjust these rates as your platform grows

export const COMMISSION_RATES = {
  FREE: 0.03,  // 3% for platform commission
  PAID: 0.03,  
};

/**
 * Get Payment Gateway transaction fee
 * Removed as per request (gateway fee absorbed or zero)
 */
export function getPaymentGatewayFee(amount) {
  return 0;
}

/**
 * Get Paywave transfer fee (B2C) based on 2026 tiers
 */
export function getTransferFee(amount) {
  if (amount <= 1500) return 20;
  if (amount <= 20000) return 40;
  return 60;
}

/**
 * Calculate platform commission and creator earnings
 * @param {number} creatorPrice - The price set by the creator (KSh)
 * @param {string} plan - Creator's plan ('FREE' or 'PAID')
 * @param {number|null} customRate - Optional global commission rate (0.0 to 1.0)
 * @returns {{ total, platformFee, paymentGatewayFee, transferFee, creatorEarnings }}
 */
export function calculateCommission(creatorPrice, plan = 'FREE', customRate = null) {
  const platformRate = (customRate !== undefined && customRate !== null) 
    ? customRate 
    : (COMMISSION_RATES[plan] || COMMISSION_RATES.FREE);
    
  const platformFee = Math.round(creatorPrice * platformRate); 
  const paymentGatewayFee = getPaymentGatewayFee(creatorPrice);
  
  // Base earnings after the platform split
  const baseEarnings = creatorPrice - platformFee - paymentGatewayFee;
  
  // Subtract the withdrawal fee (since creators cover it)
  const transferFee = getTransferFee(baseEarnings);
  const creatorEarnings = baseEarnings - transferFee;

  return {
    total: creatorPrice,
    platformFee,
    paymentGatewayFee,
    transferFee,
    commissionRate: platformRate,
    commissionPercent: '3%', // Total 3%
    creatorEarnings: Math.max(0, creatorEarnings),
  };
}
