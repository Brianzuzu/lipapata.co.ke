import { NextResponse } from 'next/server';
import { doc, getDoc, updateDoc, setDoc, serverTimestamp, increment, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../../lib/firebase';
import { checkPaywaveTransactionStatus } from '../../../../lib/paywave';

export const dynamic = 'force-dynamic';

/**
 * GET /api/pay/status?transactionId=xxx
 *
 * 1. Reads Firestore for the transaction status.
 * 2. If still 'pending', actively polls Paywave's /v1/tstatus endpoint.
 * 3. If Paywave confirms success, writes 'completed' to Firestore and
 *    credits the creator — so the next poll from the frontend sees it.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const transactionId = searchParams.get('transactionId');

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

    console.log(`[STATUS] transactionId=${transactionId} firestoreStatus=${status}`);

    // If already resolved, return immediately
    if (status === 'completed' || status === 'failed') {
      return NextResponse.json({ status });
    }

    // Still pending — actively check with Paywave, BUT only after 20 seconds
    // UNLESS the client sends forceCheck=true (e.g. user pressed "I've Paid" button).
    // Calling tstatus on a brand-new transaction (within the first ~15s while
    // the user is entering their PIN) can return a response we misread as failure.
    // The Paywave webhook handles the happy path. We only need tstatus as a fallback
    // for when the webhook is delayed or missed.
    const forceCheck = searchParams.get('forceCheck') === 'true';
    const txReqId = transaction.transactionRequestId;
    const createdAt = transaction.createdAt?.toDate?.() || null;
    const ageSeconds = createdAt ? (Date.now() - createdAt.getTime()) / 1000 : 999;

    if (txReqId && (forceCheck || ageSeconds >= 10)) {
      try {
        console.log(`[STATUS] Checking Paywave API for transactionRequestId=${txReqId} (age=${Math.round(ageSeconds)}s, forceCheck=${forceCheck})`);

        const apiRes = await checkPaywaveTransactionStatus(txReqId);
        console.log(`[STATUS] Paywave API response:`, JSON.stringify(apiRes));

        // --- Determine success from the Paywave response ---
        let isSuccess = false;
        let isFailed = false;

        // Paywave wraps the Safaricom STK callback inside the response
        let code;
        if (apiRes?.ResultCode !== undefined)                               code = apiRes.ResultCode;
        else if (apiRes?.resultCode !== undefined)                          code = apiRes.resultCode;
        else if (apiRes?.data?.ResultCode !== undefined)                    code = apiRes.data.ResultCode;
        else if (apiRes?.Body?.stkCallback?.ResultCode !== undefined)       code = apiRes.Body.stkCallback.ResultCode;
        else if (apiRes?.data?.Body?.stkCallback?.ResultCode !== undefined) code = apiRes.data.Body.stkCallback.ResultCode;

        if (code !== undefined) {
          const codeNum = Number(code);
          isSuccess = codeNum === 0;
          // Only mark failed for definitive Safaricom failure codes.
          // Don't treat "still processing" non-zero codes as failure.
          const DEFINITIVE_FAILURE_CODES = [1, 2001, 1032, 1037, 1025, 1019];
          isFailed = DEFINITIVE_FAILURE_CODES.includes(codeNum);
        } else {
          // No ResultCode — fall back to string-based heuristics
          const raw = JSON.stringify(apiRes || '').toLowerCase();
          if (raw.includes('cancel') || raw.includes('fail') || raw.includes('insufficient') || raw.includes('timeout')) {
            isFailed = true;
          } else {
            const s = (apiRes?.status || apiRes?.Status || '').toString().toLowerCase();
            isSuccess = (s === 'success' || s === 'completed' || s === 'successful' || s === 'paid');
          }
        }

        console.log(`[STATUS] isSuccess=${isSuccess}, isFailed=${isFailed}`);

        if (isSuccess) {
          // Write to Firestore — same logic as the webhook handler
          const mpesaReceiptNumber =
            apiRes?.CallbackMetadata?.Item?.find?.(i => i.Name === 'MpesaReceiptNumber')?.Value ||
            apiRes?.data?.Body?.stkCallback?.CallbackMetadata?.Item?.find?.(i => i.Name === 'MpesaReceiptNumber')?.Value ||
            apiRes?.transaction_id || apiRes?.Receipt || null;

          await updateDoc(transactionRef, {
            status: 'completed',
            paywaveTransactionId: mpesaReceiptNumber || txReqId,
            paidAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          // Mark the project as paid
          if (transaction.projectId) {
            const projectRef = doc(db, 'projects', transaction.projectId);
            await updateDoc(projectRef, {
              status: 'paid',
              paidAt: serverTimestamp(),
              sales: increment(1),
              lastUpdated: serverTimestamp(),
            });
          }

          // Credit creator
          if (transaction.creatorUid) {
            const creatorRef = doc(db, 'users', transaction.creatorUid);
            await setDoc(creatorRef, {
              balance: increment(transaction.creatorEarnings || 0),
              totalSales: increment(1),
            }, { merge: true });
          }

          console.log(`[STATUS] ✅ Marked transaction ${transactionId} as completed via active API check.`);
          status = 'completed';

        } else if (isFailed) {
          await updateDoc(transactionRef, {
            status: 'failed',
            failureReason: 'Payment cancelled or failed (verified by Paywave API)',
            updatedAt: serverTimestamp(),
          });

          if (transaction.projectId) {
            const projectRef = doc(db, 'projects', transaction.projectId);
            await updateDoc(projectRef, {
              status: 'active',
              lastUpdated: serverTimestamp(),
            });
          }

          console.log(`[STATUS] ❌ Marked transaction ${transactionId} as failed via active API check.`);
          status = 'failed';
        }
        // If neither, Paywave hasn't received a final answer yet — stay 'pending'

      } catch (apiErr) {
        // Don't crash — just return the current Firestore status
        console.error('[STATUS] Paywave API check failed:', apiErr);
      }
    }

    return NextResponse.json({ status });

  } catch (error) {
    console.error('Status Check Error:', error);
    return NextResponse.json({ error: 'Failed to check status' }, { status: 500 });
  }
}
