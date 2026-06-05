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

    // ALWAYS re-verify with PayWave when forceCheck=true (user clicked "I've Paid" button)
    // We cannot trust Firestore status here because the background poller may have
    // incorrectly marked a cancelled payment as completed.
    const shouldVerify = (status === 'pending' || forceCheck) && transaction.transactionRequestId;

    if (shouldVerify) {
      try {
        console.log(`[STATUS CHECK] Verifying transactionRequestId: ${transaction.transactionRequestId} with PayWave API (forceCheck=${forceCheck})`);
        const apiRes = await checkPaywaveTransactionStatus(transaction.transactionRequestId);
        console.log('[STATUS CHECK] RAW PayWave API Response:', JSON.stringify(apiRes));

        // Deep search for ResultCode at every possible nesting level
        let code = apiRes?.ResultCode ?? apiRes?.resultCode;
        if (code === undefined && apiRes?.data) code = apiRes.data.ResultCode ?? apiRes.data.resultCode;
        if (code === undefined && apiRes?.Body?.stkCallback) code = apiRes.Body.stkCallback.ResultCode ?? apiRes.Body.stkCallback.resultCode;
        if (code === undefined && apiRes?.data?.Body?.stkCallback) code = apiRes.data.Body.stkCallback.ResultCode ?? apiRes.data.Body.stkCallback.resultCode;

        console.log(`[STATUS CHECK] Resolved ResultCode: ${code}`);

        let isApiSuccess = false;
        if (code !== undefined) {
          // Strictly check ResultCode: only 0 or 200 means success
          isApiSuccess = (code === 0 || code === '0' || code === '00' || code === 200 || code === '200');
        } else {
          // No ResultCode found — scan full response for failure keywords first
          const fullResStr = JSON.stringify(apiRes).toLowerCase();
          const hasFailureKeyword = fullResStr.includes('cancel') || fullResStr.includes('fail') || 
                                    fullResStr.includes('insufficient') || fullResStr.includes('timeout') ||
                                    fullResStr.includes('declined') || fullResStr.includes('reject');
          if (hasFailureKeyword) {
            isApiSuccess = false;
          } else {
            // Only allow status-based approval if no code and no failure keywords
            const apiStatus = (apiRes?.status || '').toString().toLowerCase();
            isApiSuccess = (apiStatus === 'success' || apiStatus === 'completed' || apiStatus === 'successful');
          }
        }

        console.log(`[STATUS CHECK] isApiSuccess=${isApiSuccess}`);

        if (isApiSuccess) {
          const verifiedTxId = apiRes?.transaction_id || apiRes?.transactionId || apiRes?.Receipt || 'PWX-VERIFIED';
          await handlePaywaveConfirmation(transaction.reference, 'success', verifiedTxId);
          status = 'completed';
        } else {
          // PayWave confirmed it's NOT a success — mark as failed regardless of previous Firestore status
          console.log(`[STATUS CHECK] Transaction not successful. Marking as failed. Code: ${code}`);
          await handlePaywaveConfirmation(transaction.reference, 'failed', null);
          status = 'failed';
        }
      } catch (apiErr) {
        console.error('[STATUS CHECK] PayWave API status check failed:', apiErr);
        // On error, don't unlock — keep the existing Firestore status
      }
    }

    return NextResponse.json({ status });



  } catch (error) {
    console.error('Status Check Error:', error);
    return NextResponse.json({ error: 'Failed to check status' }, { status: 500 });
  }
}
