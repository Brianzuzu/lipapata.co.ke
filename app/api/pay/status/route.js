import { NextResponse } from 'next/server';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../../lib/firebase';
import { checkPaywaveTransactionStatus } from '../../../../lib/paywave';
import { handlePaywaveConfirmation } from '../../webhooks/paywave/route';

export const dynamic = 'force-dynamic';

/**
 * GET /api/pay/status?transactionId=xxx
 * Polls Firestore for the current transaction status.
 * If pending, optionally queries PayWave Express status API directly as a secure fallback.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const transactionId = searchParams.get('transactionId');
    const forceCheck = searchParams.get('forceCheck') === 'true';

    if (!transactionId) {
      return NextResponse.json({ error: 'Missing transactionId' }, { status: 400 });
    }

    const transactionRef = doc(db, 'transactions', transactionId);
    const transSnap = await getDoc(transactionRef);

    if (!transSnap.exists()) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    const transaction = transSnap.data();
    let status = transaction.status || 'pending';

    // If transaction is pending, verify directly with PayWave Express API
    if (status === 'pending' && transaction.transactionRequestId) {
      try {
        console.log(`[STATUS CHECK] Verifying transactionRequestId: ${transaction.transactionRequestId} with PayWave API`);
        const apiRes = await checkPaywaveTransactionStatus(transaction.transactionRequestId);
        console.log('[STATUS CHECK] PayWave API Response:', JSON.stringify(apiRes));

        const isApiSuccess = apiRes && (
          apiRes.status === 'success' || 
          apiRes.status === 'completed' || 
          apiRes.status === 'successful' || 
          apiRes.resultCode === 0 || 
          apiRes.resultCode === '0' ||
          apiRes.ResultCode === '0' ||
          apiRes.ResultCode === 0 ||
          apiRes.ResultCode === '200' ||
          apiRes.ResultCode === 200 ||
          (apiRes.ResultDesc && apiRes.ResultDesc.toLowerCase().includes('success'))
        );

        if (isApiSuccess) {
          const verifiedTxId = apiRes.transaction_id || apiRes.transactionId || apiRes.Receipt || 'PWX-VERIFIED';
          await handlePaywaveConfirmation(transaction.reference, 'success', verifiedTxId);
          status = 'completed';
        } else if (apiRes && (apiRes.ResultCode || apiRes.resultCode || apiRes.ResponseCode || (apiRes.status && apiRes.status === 'failed'))) {
          // If PayWave API returns a definitive result code that isn't success, mark as failed
          console.log(`[STATUS CHECK] Transaction failed. API Response:`, apiRes);
          await handlePaywaveConfirmation(transaction.reference, 'failed', null);
          status = 'failed';
        }
      } catch (apiErr) {
        console.error('[STATUS CHECK] PayWave API status check failed:', apiErr);
      }
    }

    return NextResponse.json({ status });

  } catch (error) {
    console.error('Status Check Error:', error);
    return NextResponse.json({ error: 'Failed to check status' }, { status: 500 });
  }
}
