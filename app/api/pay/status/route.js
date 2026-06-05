import { NextResponse } from 'next/server';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../../lib/firebase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/pay/status?transactionId=xxx[&forceCheck=true]
 *
 * IMPORTANT: This route ONLY reads Firestore. It does NOT call the PayWave
 * status API. The ONLY thing that can mark a transaction as 'completed' is
 * the PayWave server-to-server webhook POST to /api/webhooks/paywave.
 *
 * This prevents cancelled STK pushes from unlocking downloads, because
 * PayWave will send a failed/cancelled webhook, which marks the transaction
 * as 'failed' in Firestore. The poller then picks that up correctly.
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
    const status = transaction.status || 'pending';

    console.log(`[STATUS] transactionId=${transactionId} status=${status}`);

    return NextResponse.json({ status });

  } catch (error) {
    console.error('Status Check Error:', error);
    return NextResponse.json({ error: 'Failed to check status' }, { status: 500 });
  }
}
