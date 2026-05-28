/**
 * Paystack Integration Utility
 * Handles Payment Initialization and Transfers (Payouts)
 */

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE_URL = 'https://api.paystack.co';

/**
 * Initialize a transaction
 * @param {Object} params - email, amount (in KES), reference, metadata
 */
export async function initializeTransaction({ email, amount, reference, metadata }) {
  try {
    const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: Math.round(amount * 100), // Paystack expects amount in cents/lowest unit
        currency: 'KES',
        reference,
        metadata,
        channels: ['mobile_money', 'card'],
      }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Paystack Initialize Error:', error);
    throw new Error('Failed to initialize Paystack transaction');
  }
}

/**
 * Verify a transaction
 * @param {string} reference 
 */
export async function verifyTransaction(reference) {
  try {
    const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/verify/${reference}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      },
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Paystack Verify Error:', error);
    throw new Error('Failed to verify Paystack transaction');
  }
}

/**
 * Create a Transfer Recipient
 * @param {string} name - Creator's Name
 * @param {string} phoneNumber - M-Pesa Number (2547XXXXXXXX)
 */
export async function createTransferRecipient(name, phoneNumber) {
  try {
    const response = await fetch(`${PAYSTACK_BASE_URL}/transferrecipient`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'm-pesa',
        name,
        account_number: phoneNumber,
        bank_code: 'MPESA',
        currency: 'KES',
      }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Paystack Recipient Error:', error);
    throw new Error('Failed to create transfer recipient');
  }
}

/**
 * Initiate a Transfer (Payout)
 * @param {number} amount - Amount in KES
 * @param {string} recipient - Recipient code from createTransferRecipient
 * @param {string} reason - Optional reason
 */
export async function initiateTransfer(amount, recipient, reason = 'Lipapata Creator Payout') {
  try {
    const response = await fetch(`${PAYSTACK_BASE_URL}/transfer`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source: 'balance',
        amount: Math.round(amount * 100),
        currency: 'KES',
        recipient,
        reason,
      }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Paystack Transfer Error:', error);
    throw new Error('Failed to initiate transfer');
  }
}
