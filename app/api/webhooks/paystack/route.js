import { NextResponse } from 'next/server';
import { db } from '../../../../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  updateDoc, 
  doc, 
  serverTimestamp,
  increment 
} from 'firebase/firestore';
import crypto from 'crypto';

/**
 * Paystack Webhook Handler
 */
export async function POST(request) {
  try {
    const body = await request.text();
    const secret = process.env.PAYSTACK_SECRET_KEY;
    
    // 1. Verify Signature
    const hash = crypto.createHmac('sha512', secret).update(body).digest('hex');
    const signature = request.headers.get('x-paystack-signature');

    if (hash !== signature) {
      console.warn('⚠️ Invalid Paystack Signature');
      return NextResponse.json({ message: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(body);
    console.log(`📩 Paystack Webhook Received: ${event.event}`);

    // 2. Handle charge.success (Payments)
    if (event.event === 'charge.success') {
      const { reference, metadata, amount, customer } = event.data;
      
      // Find the corresponding transaction in Firestore
      const transactionsRef = collection(db, 'transactions');
      const q = query(transactionsRef, where('reference', '==', reference));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        console.error(`❌ Transaction not found for Reference: ${reference}`);
        return NextResponse.json({ message: 'Transaction not found' }, { status: 404 });
      }

      const transactionDoc = querySnapshot.docs[0];
      const transactionData = transactionDoc.data();
      const transactionRef = doc(db, 'transactions', transactionDoc.id);

      if (transactionData.status === 'completed') {
        return NextResponse.json({ message: 'Already processed' });
      }

      // Update Transaction status
      await updateDoc(transactionRef, {
        status: 'completed',
        paystackData: event.data,
        updatedAt: serverTimestamp(),
      });

      // Update Project status
      const projectRef = doc(db, 'projects', transactionData.projectId);
      await updateDoc(projectRef, {
        status: 'paid',
        paymentStatus: 'success',
        sales: increment(1),
        lastUpdated: serverTimestamp(),
      });

      // Update Creator's Balance
      const creatorRef = doc(db, 'users', transactionData.creatorUid);
      const earnings = transactionData.creatorEarnings || 0;
      
      await updateDoc(creatorRef, {
        balance: increment(earnings),
        totalSales: increment(1)
      });

      console.log(`✅ Payment Successful for Reference: ${reference}. Creator earnings KSh ${earnings} added.`);
    }

    // 3. Handle transfer.success (Payouts)
    if (event.event === 'transfer.success') {
      const { transfer_code, recipient } = event.data;
      
      const withdrawalsRef = collection(db, 'withdrawals');
      const q = query(withdrawalsRef, where('transferCode', '==', transfer_code));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const withdrawalDoc = querySnapshot.docs[0];
        await updateDoc(doc(db, 'withdrawals', withdrawalDoc.id), {
          status: 'completed',
          processedAt: serverTimestamp(),
          paystackTransferData: event.data
        });
        console.log(`✅ Payout Successful: Transfer ${transfer_code} completed.`);
      }
    }

    // 4. Handle transfer.failed or transfer.reversed
    if (event.event === 'transfer.failed' || event.event === 'transfer.reversed') {
      const { transfer_code } = event.data;
      
      const withdrawalsRef = collection(db, 'withdrawals');
      const q = query(withdrawalsRef, where('transferCode', '==', transfer_code));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const withdrawalDoc = querySnapshot.docs[0];
        const withdrawalData = withdrawalDoc.data();

        // Update withdrawal status to failed
        await updateDoc(doc(db, 'withdrawals', withdrawalDoc.id), {
          status: 'failed',
          failureReason: event.data.reason || 'Transfer failed/reversed',
          updatedAt: serverTimestamp()
        });

        // REVERSE the balance in user account so they can try again
        const creatorRef = doc(db, 'users', withdrawalData.creatorUid);
        await updateDoc(creatorRef, {
          balance: increment(withdrawalData.amount)
        });

        console.log(`❌ Payout Failed/Reversed: Transfer ${transfer_code}. Balance restored for creator.`);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Paystack Webhook Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
