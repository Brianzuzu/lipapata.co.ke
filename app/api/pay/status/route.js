import { NextResponse } from 'next/server';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../../../lib/firebase';
import { checkPaywaveTransactionStatus } from '../../../../lib/paywave';

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

    // If it's already completed or failed in our DB, just return that
    if (transaction.status === 'completed' || transaction.status === 'failed') {
      return NextResponse.json({ status: transaction.status });
    }

    const transactionRequestId = transaction.transactionRequestId;
    if (!transactionRequestId) {
      // If we don't have the request ID, we can't poll PayWave. Just return pending.
      return NextResponse.json({ status: 'pending' });
    }

    // Call PayWave to check the status
    const paywaveStatus = await checkPaywaveTransactionStatus(transactionRequestId);

    // According to screenshot, Success response gives ResultCode "200" and TransactionStatus
    // If ResultCode is 200, we check TransactionStatus
    if (paywaveStatus.ResultCode === "200") {
      if (paywaveStatus.TransactionStatus === "Completed" || paywaveStatus.TransactionStatus === "Success") {
        await updateDoc(transactionRef, {
          status: 'completed',
          updatedAt: new Date(),
          receipt: paywaveStatus.TransactionReceipt || null,
        });
        return NextResponse.json({ status: 'completed' });
      } else if (paywaveStatus.TransactionStatus === "Failed" || paywaveStatus.TransactionStatus === "Cancelled") {
        await updateDoc(transactionRef, {
          status: 'failed',
          updatedAt: new Date(),
          failureReason: paywaveStatus.ResultDesc || 'Transaction Failed',
        });
        return NextResponse.json({ status: 'failed' });
      } else {
        // Pending
        return NextResponse.json({ status: 'pending' });
      }
    } else if (paywaveStatus.ResultCode && paywaveStatus.ResultCode !== "0") {
       // An error code from PayWave Express
       await updateDoc(transactionRef, {
        status: 'failed',
        updatedAt: new Date(),
        failureReason: paywaveStatus.ResultDesc || paywaveStatus.errorMessage || 'Transaction Error',
      });
      return NextResponse.json({ status: 'failed' });
    }

    return NextResponse.json({ status: 'pending' });

  } catch (error) {
    console.error('Status Check Error:', error);
    return NextResponse.json({ error: 'Failed to check status' }, { status: 500 });
  }
}
