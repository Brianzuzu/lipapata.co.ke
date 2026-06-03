/**
 * Paywave Express Integration Utility
 * Uses hosted payment page redirect approach
 */

const PAYWAVE_PAYMENT_URL = process.env.PAYWAVE_PAYMENT_URL || 'https://paywavexpress.co.ke/pay/lipapata';
const PAYWAVE_API_KEY = process.env.PAYWAVE_API_KEY;
// The email registered with Paywave Express / OpenFloat (your merchant account email)
const PAYWAVE_MERCHANT_EMAIL = process.env.PAYWAVE_MERCHANT_EMAIL || '';

/**
 * Build the Paywave Express hosted payment page URL.
 * The customer is redirected to this URL to complete payment.
 *
 * @param {Object} params
 * @param {string} params.customerEmail - Customer email (for receipt, passed as customer_email)
 * @param {number} params.amount        - Amount in KSh
 * @param {string} params.reference     - Unique transaction reference
 * @param {string} params.phoneNumber   - Customer phone (2547XXXXXXXX)
 * @param {string} params.description   - Short description of what is being paid for
 * @param {string} params.callbackUrl   - URL to redirect after payment
 */
export function buildPaywavePaymentUrl({ customerEmail, email, amount, reference, phoneNumber, description, callbackUrl }) {
  const params = new URLSearchParams({
    api_key:        PAYWAVE_API_KEY || '',
    amount:         Math.round(amount),
    // 'email' must be the MERCHANT's registered OpenFloat/Paywave account email
    email:          PAYWAVE_MERCHANT_EMAIL || email || '',
    // Pass the customer's email separately so Paywave can use it for receipts
    customer_email: customerEmail || email || '',
    phone:          phoneNumber,
    reference:      reference,
    desc:           description || 'Lipapata Digital Content',
    callback:       callbackUrl || '',
  });

  return `${PAYWAVE_PAYMENT_URL}?${params.toString()}`;
}

/**
 * Initiate a B2C Payout / Withdrawal via Paywave Express API
 * @param {number} amount       - Amount to send in KSh
 * @param {string} phoneNumber  - Recipient phone (2547XXXXXXXX)
 * @param {string} email        - Recipient / account email (required by OpenFloat)
 * @param {string} reason       - Payment description
 */
export async function initiatePaywavePayout(amount, phoneNumber, email, reason = 'Creator Payout') {
  const apiKey = PAYWAVE_API_KEY;
  const callbackUrl = process.env.NEXT_PUBLIC_BASE_URL
    ? `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhooks/paywave-payout`
    : 'https://lipapata.co.ke/api/webhooks/paywave-payout';

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

  if (!email) {
    console.error('❌ Paywave Payout requires a registered email address.');
    return {
      status: false,
      message: 'Payout requires a registered email address for the OpenFloat payment API.',
    };
  }

  const payload = {
    api_key:      apiKey,
    amount:       Math.round(amount),
    phone_number: phoneNumber,
    email:        email,
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

/**
 * Initiate a direct STK Push via Paywave Express API (v1/stkpush)
 */
export async function initiatePaywaveDirectStkPush({ email, amount, phoneNumber, reference }) {
  let apiKey = PAYWAVE_API_KEY;
  if (!apiKey) throw new Error('Paywave API key missing');
  apiKey = apiKey.trim();

  // For the Direct API, the email MUST be the merchant's registered email. 
  // If PAYWAVE_MERCHANT_EMAIL isn't set, we fall back to the customer's email, which might cause "invalid api key" if PayWave validates the pair.
  const payload = {
    api_key: apiKey,
    email: PAYWAVE_MERCHANT_EMAIL || email || '',
    amount: Math.round(amount).toString(),
    msisdn: phoneNumber,
    reference: reference,
  };

  const response = await fetch('https://paywavexpress.co.ke/v1/stkpush', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  console.log('PayWave STK Push Response:', data);
  return data;
}

/**
 * Check transaction status via Paywave Express API (v1/tstatus)
 */
export async function checkPaywaveTransactionStatus(transactionRequestId) {
  let apiKey = PAYWAVE_API_KEY;
  if (!apiKey) throw new Error('Paywave API key missing');
  apiKey = apiKey.trim();

  const payload = {
    api_key: apiKey,
    email: PAYWAVE_MERCHANT_EMAIL || '',
    transaction_request_id: transactionRequestId,
  };

  const response = await fetch('https://paywavexpress.co.ke/v1/tstatus', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  console.log('PayWave Status Check Response:', data);
  return data;
}
