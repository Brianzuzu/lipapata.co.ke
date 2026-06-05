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

        let isApiSuccess = false;
        if (apiRes) {
          // Deep search for ResultCode (M-Pesa wraps it in Body.stkCallback or PayWave wraps in data)
          let code = apiRes.ResultCode ?? apiRes.resultCode;
          if (code === undefined && apiRes.data) code = apiRes.data.ResultCode ?? apiRes.data.resultCode;
          if (code === undefined && apiRes.Body?.stkCallback) code = apiRes.Body.stkCallback.ResultCode ?? apiRes.Body.stkCallback.resultCode;
          if (code === undefined && apiRes.data?.Body?.stkCallback) code = apiRes.data.Body.stkCallback.ResultCode ?? apiRes.data.Body.stkCallback.resultCode;

          if (code !== undefined) {
            isApiSuccess = (code === 0 || code === '0' || code === '00' || code === 200 || code === '200');
          } else {
            const apiStatus = (apiRes.status || '').toString().toLowerCase();
            isApiSuccess = (apiStatus === 'success' || apiStatus === 'completed' || apiStatus === 'successful');
          }
        }

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
