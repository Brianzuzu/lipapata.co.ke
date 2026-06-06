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

  const emailToSend = PAYWAVE_MERCHANT_EMAIL || email || '';

  // The callback_url tells Paywave where to POST the payment result.
  // WITHOUT this field, Paywave has no webhook to call and the transaction
  // will never be confirmed automatically.
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://lipapata.co.ke';
  const callbackUrl = `${baseUrl}/api/webhooks/paywave`;

  console.log(`[PAY] PayWave STK Push: email="${emailToSend}", callback="${callbackUrl}", apiKeyPrefix="${apiKey.substring(0, 6)}..."`);

  const payload = {
    api_key:      apiKey,
    email:        emailToSend,
    amount:       Math.round(amount).toString(),
    msisdn:       phoneNumber,
    reference:    reference,
    callback_url: callbackUrl,
  };

  const response = await fetch('https://paywavexpress.co.ke/v1/stkpush', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
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
 * Returns the raw Paywave response — the caller is responsible for parsing.
 */
export async function checkPaywaveTransactionStatus(transactionRequestId) {
  let apiKey = PAYWAVE_API_KEY;
  if (!apiKey) throw new Error('Paywave API key missing');
  apiKey = apiKey.trim();

  const payload = {
    api_key:                apiKey,
    email:                  PAYWAVE_MERCHANT_EMAIL || '',
    transaction_request_id: transactionRequestId,
  };

  const response = await fetch('https://paywavexpress.co.ke/v1/tstatus', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  // Log the FULL raw response so we can see exactly what Paywave returns
  console.log('[TSTATUS] Raw Paywave response:', JSON.stringify(data));
  return data;
}

/**
 * Parse a Paywave tstatus (or webhook) response and return
 * { isSuccess, isFailed } so callers don't duplicate this logic.
 *
 * Handles all known Paywave response shapes:
 *   { ResultCode: 0 }                            -> success
 *   { success: true }  or  { success: "200" }   -> success
 *   { status: "success" | "paid" | "completed" } -> success
 *   { ResultCode: 1032 | 1 | 2001 ... }          -> definitive failure
 *   { status: false } or keywords (cancel/fail)  -> failure
 *   anything else                                 -> still pending (neither)
 */
export function parsePaywaveResult(apiRes) {
  let isSuccess = false;
  let isFailed  = false;

  if (!apiRes) return { isSuccess, isFailed };

  // 1. Check tstatus specific fields: TransactionStatus and TransactionCode
  // Paywave tstatus returns ResultCode: "200" for both success and failure,
  // and puts the actual result in TransactionStatus and TransactionCode.
  if (apiRes.TransactionStatus) {
    const tStatus = apiRes.TransactionStatus.toLowerCase();
    if (tStatus === 'completed' || tStatus === 'success' || tStatus === 'paid') {
      return { isSuccess: true, isFailed: false };
    }
    if (tStatus === 'cancelled' || tStatus === 'failed') {
      return { isSuccess: false, isFailed: true };
    }
  }

  if (apiRes.TransactionCode !== undefined && apiRes.TransactionCode !== null && apiRes.TransactionCode !== '') {
    const tCode = Number(apiRes.TransactionCode);
    if (tCode === 0) return { isSuccess: true, isFailed: false };
    const FAILURE_CODES = [1, 2001, 1032, 1037, 1025, 1019];
    if (FAILURE_CODES.includes(tCode)) return { isSuccess: false, isFailed: true };
  }

  // 2. Check for explicit ResultCode (Safaricom STK callback standard)
  let code;
  if (apiRes.ResultCode              !== undefined) code = apiRes.ResultCode;
  else if (apiRes.resultCode         !== undefined) code = apiRes.resultCode;
  else if (apiRes.data?.ResultCode   !== undefined) code = apiRes.data.ResultCode;
  else if (apiRes.Body?.stkCallback?.ResultCode !== undefined)
    code = apiRes.Body.stkCallback.ResultCode;
  else if (apiRes.data?.Body?.stkCallback?.ResultCode !== undefined)
    code = apiRes.data.Body.stkCallback.ResultCode;

  if (code !== undefined) {
    const codeNum = Number(code);
    // Ignore ResultCode=200 if we didn't match TransactionStatus above,
    // because Paywave uses ResultCode 200 just to say "Request OK".
    if (codeNum !== 200) {
      if (codeNum === 0) return { isSuccess: true, isFailed: false };
      const FAILURE_CODES = [1, 2001, 1032, 1037, 1025, 1019];
      if (FAILURE_CODES.includes(codeNum)) return { isSuccess: false, isFailed: true };
    }
  }

  // 3. Paywave-native success fields
  const successField = apiRes.success;
  if (successField === true || successField === 'true') {
    return { isSuccess: true, isFailed: false };
  }

  // 4. String status field
  const s = (apiRes.status || apiRes.Status || '')
    .toString().toLowerCase().trim();

  if (s === 'success' || s === 'completed' || s === 'successful' || s === 'paid') {
    return { isSuccess: true, isFailed: false };
  }

  if (s === 'false' || s === 'failed' || s === 'fail') {
    return { isSuccess: false, isFailed: true };
  }

  // 5. Keyword scan as last resort
  const raw = JSON.stringify(apiRes).toLowerCase();
  if (raw.includes('cancel') || raw.includes('insufficient') ||
      raw.includes('timeout') || raw.includes('rejected')) {
    return { isSuccess: false, isFailed: true };
  }

  return { isSuccess: false, isFailed: false };
}
