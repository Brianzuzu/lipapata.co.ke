import { NextResponse } from 'next/server';
import { db } from '../../../../lib/firebase';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';

export async function POST(request) {
  try {
    // Verify webhook secret if configured
    const webhookSecret = process.env.PAYWAVE_WEBHOOK_SECRET;
    if (webhookSecret) {
      const provided = request.headers.get('x-paywave-secret');
      if (provided !== webhookSecret) {
        return new NextResponse('Unauthorized', { status: 401 });
      }
    }

    const payload = await request.json();

    const { paywavePayoutId, status, message } = payload;

    if (!paywavePayoutId) {
      return new NextResponse('Invalid Payload', { status: 400 });
    }

    // Find the withdrawal in Firestore
    const q = query(collection(db, 'withdrawals'), where('paywavePayoutId', '==', paywavePayoutId));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return new NextResponse('Withdrawal not found', { status: 404 });
    }

    const withdrawalDoc = querySnapshot.docs[0];
    const withdrawalData = withdrawalDoc.data();

    if (withdrawalData.status === 'completed') {
      return new NextResponse('Withdrawal already completed', { status: 200 });
    }

    // Update Withdrawal based on Paywave Express status
    if (status === 'successful' || status === 'completed') {
      await updateDoc(doc(db, 'withdrawals', withdrawalDoc.id), {
        status: 'completed',
        completedAt: new Date().toISOString(),
      });
    } else if (status === 'failed' || status === 'cancelled' || status === 'reversed') {
      await updateDoc(doc(db, 'withdrawals', withdrawalDoc.id), {
        status: 'failed',
        failureReason: message || 'Payout failed',
      });
    }

    return new NextResponse('Webhook Received', { status: 200 });
  } catch (error) {
    console.error('Paywave Payout Webhook Error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
