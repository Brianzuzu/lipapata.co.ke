import { NextResponse } from 'next/server';
import { db } from '../../../../lib/firebase';
import { doc, getDoc, updateDoc, serverTimestamp, increment, setDoc } from 'firebase/firestore';

export async function POST(request) {
  try {
    const { transactionId, mpesaMessage } = await request.json();

    if (!transactionId || !mpesaMessage) {
      return NextResponse.json({ error: 'Missing transaction ID or M-Pesa message' }, { status: 400 });
    }

    const txRef = doc(db, 'transactions', transactionId);
    const txSnap = await getDoc(txRef);

    if (!txSnap.exists()) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    const txData = txSnap.data();

    if (txData.status === 'completed') {
      return NextResponse.json({ success: true, message: 'Already completed' });
    }

    // Extract receipt code (10 alphanumeric characters, usually starting with the current year's letter, e.g., S, T, U)
    const receiptMatch = mpesaMessage.match(/\b[A-Z0-9]{10}\b/);
    const receiptCode = receiptMatch ? receiptMatch[0] : 'UNKNOWN';

    // Verify the amount is somewhere in the message
    const amountStr = Math.round(txData.amount || 0).toString();
    if (!mpesaMessage.includes(amountStr) && !mpesaMessage.includes(Number(txData.amount).toFixed(2))) {
      return NextResponse.json({ error: 'The M-Pesa message does not seem to match the correct amount.' }, { status: 400 });
    }

    // Update transaction to completed via manual override
    await updateDoc(txRef, {
      status: 'completed',
      isManualOverride: true,
      manualReceiptCode: receiptCode,
      manualMpesaMessage: mpesaMessage,
      paidAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Update project to paid
    if (txData.projectId) {
      const projectRef = doc(db, 'projects', txData.projectId);
      await updateDoc(projectRef, {
        status: 'paid',
        paidAt: serverTimestamp(),
        sales: increment(1),
        lastUpdated: serverTimestamp(),
      });
    }

    // Update creator's balance
    if (txData.creatorUid) {
      const creatorRef = doc(db, 'users', txData.creatorUid);
      const earnings = txData.creatorEarnings || 0;
      await setDoc(creatorRef, {
        balance: increment(earnings),
        totalSales: increment(1)
      }, { merge: true });
    }

    console.log(`[MANUAL OVERRIDE] Transaction ${transactionId} verified manually with receipt ${receiptCode}`);

    return NextResponse.json({ success: true, receiptCode });

  } catch (error) {
    console.error('[MANUAL OVERRIDE ERROR]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
