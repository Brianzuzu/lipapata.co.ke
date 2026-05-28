/**
 * M-Pesa Integration Utility
 * Handles STK Push requests and OAuth token generation for both Sandbox and Production.
 */

// Environment URLs
const SANDBOX_BASE_URL = 'https://sandbox.safaricom.co.ke';
const PRODUCTION_BASE_URL = 'https://api.safaricom.co.ke';

const getBaseUrl = () => process.env.MPESA_ENVIRONMENT === 'production' ? PRODUCTION_BASE_URL : SANDBOX_BASE_URL;

/**
 * Generate M-Pesa OAuth Token
 */
export async function getAccessToken() {
  const consumerKey = process.env.MPESA_CONSUMER_KEY;
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET;

  if (!consumerKey || !consumerSecret) {
    // If credentials missing, we return a mock token for development
    console.warn('⚠️ M-Pesa credentials missing. Using MOCK mode.');
    return 'MOCK_TOKEN';
  }

  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');

  try {
    const response = await fetch(`${getBaseUrl()}/oauth/v1/generate?grant_type=client_credentials`, {
      method: 'GET',
      headers: {
        Authorization: `Basic ${auth}`,
      },
    });

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error('M-Pesa Auth Error:', error);
    throw new Error('Failed to authenticate with M-Pesa');
  }
}

/**
 * Send money to a customer (B2C)
 * @param {string} phoneNumber - Recipient's phone number
 * @param {number} amount - Amount to send
 * @param {string} remarks - Optional remarks
 */
export async function sendB2CPayment(phoneNumber, amount, remarks = 'Lipapata Creator Payout') {
  const token = await getAccessToken();

  if (token === 'MOCK_TOKEN') {
    console.log(`[MOCK B2C] Sending ${amount} KSh to ${phoneNumber}...`);
    return {
      ConversationID: `MOCK-B2C-${Math.random().toString(36).substr(2, 9)}`,
      OriginatorConversationID: `MOCK-B2C-${Math.random().toString(36).substr(2, 9)}`,
      ResponseCode: '0',
      ResponseDescription: 'Accept the service request successfully.',
      mock: true
    };
  }

  const payload = {
    InitiatorName: process.env.MPESA_INITIATOR_NAME,
    SecurityCredential: process.env.MPESA_SECURITY_CREDENTIAL,
    CommandID: 'BusinessPayment',
    Amount: Math.round(amount),
    PartyA: process.env.MPESA_SHORTCODE,
    PartyB: phoneNumber,
    Remarks: remarks,
    QueueTimeOutURL: process.env.MPESA_B2C_TIMEOUT_URL,
    ResultURL: process.env.MPESA_B2C_RESULT_URL,
    Occasion: 'Payout'
  };

  try {
    const response = await fetch(`${getBaseUrl()}/mpesa/b2c/v1/paymentrequest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    return await response.json();
  } catch (error) {
    console.error('B2C Payout Error:', error);
    throw new Error('Failed to initiate M-Pesa payout');
  }
}

/**
 * Initiate M-Pesa STK Push
 * Supports both Paybill and Buy Goods (Till)
 * @param {string} phoneNumber - User's phone number (format: 2547XXXXXXXX)
 * @param {number} amount - Amount to charge (KSh)
 * @param {string} accountReference - Usually the Project ID
 * @param {string} transactionDesc - Description of the transaction
 */
export async function initiateStkPush(phoneNumber, amount, accountReference, transactionDesc = 'Lipapata Digital Content') {
  const token = await getAccessToken();

  // Mock implementation if in development/missing keys
  if (token === 'MOCK_TOKEN') {
    console.log(`[MOCK STK PUSH] Sending ${amount} KSh request to ${phoneNumber}...`);
    return {
      MerchantRequestID: `MOCK-${Math.random().toString(36).substr(2, 9)}`,
      CheckoutRequestID: `MOCK-${Math.random().toString(36).substr(2, 9)}`,
      ResponseCode: '0',
      ResponseDescription: 'Success. Request accepted for processing',
      CustomerMessage: 'Success. Request accepted for processing',
      mock: true
    };
  }

  const timestamp = new Date().toISOString().replace(/[-:T]/g, '').split('.')[0];
  
  // For Buy Goods Till: 
  // BusinessShortCode = Store Number
  // PartyB = Till Number
  // For Paybill:
  // BusinessShortCode = Paybill Number
  // PartyB = Paybill Number
  const shortCode = process.env.MPESA_STORE_NUMBER || process.env.MPESA_SHORTCODE;
  const tillNumber = process.env.MPESA_TILL_NUMBER; // Only for Buy Goods
  const passkey = process.env.MPESA_PASSKEY;
  
  const password = Buffer.from(`${shortCode}${passkey}${timestamp}`).toString('base64');
  const callbackUrl = process.env.MPESA_CALLBACK_URL;

  const payload = {
    BusinessShortCode: shortCode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: tillNumber ? 'CustomerBuyGoodsOnline' : 'CustomerPayBillOnline',
    Amount: Math.round(amount),
    PartyA: phoneNumber,
    PartyB: tillNumber || shortCode,
    PhoneNumber: phoneNumber,
    CallBackURL: callbackUrl,
    AccountReference: accountReference,
    TransactionDesc: transactionDesc,
  };

  try {
    const response = await fetch(`${getBaseUrl()}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    return await response.json();
  } catch (error) {
    console.error('STK Push Error:', error);
    throw new Error('Failed to initiate M-Pesa payment');
  }
}
