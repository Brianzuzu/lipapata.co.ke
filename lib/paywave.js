/**
 * Paywave Express Integration Utility
 * Uses hosted payment page redirect approach
 */

const PAYWAVE_PAYMENT_URL = process.env.PAYWAVE_PAYMENT_URL || 'https://paywavexpress.co.ke/pay/lipapata';
const PAYWAVE_API_KEY = process.env.PAYWAVE_API_KEY;

/**
 * Build the Paywave Express hosted payment page URL.
 * The customer is redirected to this URL to complete payment.
 *
 * @param {Object} params
 * @param {string} params.email        - Customer email
 * @param {number} params.amount       - Amount in KSh
 * @param {string} params.reference    - Unique transaction reference
 * @param {string} params.phoneNumber  - Customer phone (2547XXXXXXXX)
 * @param {string} params.description  - Short description of what is being paid for
 * @param {string} params.callbackUrl  - URL to redirect after payment
 */
export function buildPaywavePaymentUrl({ email, amount, reference, phoneNumber, description, callbackUrl }) {
  const params = new URLSearchParams({
    api_key:   PAYWAVE_API_KEY || '',
    amount:    Math.round(amount),
    email:     email,
    phone:     phoneNumber,
    reference: reference,
    desc:      description || 'Lipapata Digital Content',
    callback:  callbackUrl || '',
  });

  return `${PAYWAVE_PAYMENT_URL}?${params.toString()}`;
}

/**
 * Initiate a B2C Payout / Withdrawal via Paywave Express API
 * @param {number} amount       - Amount to send in KSh
 * @param {string} phoneNumber  - Recipient phone (2547XXXXXXXX)
 * @param {string} reason       - Payment description
 */
export async function initiatePaywavePayout(amount, phoneNumber, reason = 'Creator Payout') {
  const apiKey = PAYWAVE_API_KEY;
  const callbackUrl = process.env.NEXT_PUBLIC_BASE_URL
    ? `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhooks/paywave-payout`
    : 'http://localhost:3000/api/webhooks/paywave-payout';

  if (!apiKey) {
    console.warn('⚠️ Paywave Express API key missing. Using MOCK payout mode.');
    return {
      status: true,
      message: 'Mock payout initiated',
      data: {
        id: `MOCK-PAYOUT-${Date.now()}`,
        status: 'processing',
      },
    };
  }

  const payload = {
    api_key:      apiKey,
    amount:       Math.round(amount),
    phone_number: phoneNumber,
    reason:       reason,
    callback_url: callbackUrl,
  };

  try {
    const response = await fetch('https://paywavexpress.co.ke/api/v1/payouts/initiate', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Paywave Payout Error:', error);
    return {
      status: false,
      message: 'Failed to reach Paywave Express Payout API',
    };
  }
}
