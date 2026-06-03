import { NextResponse } from 'next/server';
import { db } from '../../../../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  updateDoc, 
  setDoc,
  doc, 
  serverTimestamp,
  increment 
} from 'firebase/firestore';

/**
 * M-Pesa Callback Handler
 * Reference: https://developer.safaricom.co.ke/docs#callback-response
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { Body: { stkCallback } } = body;

    const {
      MerchantRequestID,
      CheckoutRequestID,
      ResultCode,
      ResultDesc,
      CallbackMetadata
    } = stkCallback;

    console.log(`📩 M-Pesa Callback Received: ${ResultDesc} (ResultCode: ${ResultCode})`);

    // 1. Find the corresponding transaction in Firestore
    const transactionsRef = collection(db, 'transactions');
    const q = query(transactionsRef, where('checkoutRequestId', '==', CheckoutRequestID));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      console.error(`❌ Transaction not found for CheckoutRequestID: ${CheckoutRequestID}`);
      return NextResponse.json({ message: 'Transaction not found' }, { status: 404 });
    }

    const transactionDoc = querySnapshot.docs[0];
    const transactionData = transactionDoc.data();
    const transactionRef = doc(db, 'transactions', transactionDoc.id);

    // 2. Handle Success (ResultCode 0)
    if (ResultCode === 0) {
      // Extract metadata (receipt number, etc.)
      const metadataItems = CallbackMetadata.Item;
      const mpesaReceiptNumber = metadataItems.find(i => i.Name === 'MpesaReceiptNumber')?.Value;
      const transactionDate = metadataItems.find(i => i.Name === 'TransactionDate')?.Value;

      // Update Transaction status
      await updateDoc(transactionRef, {
        status: 'completed',
        mpesaReceiptNumber,
        mpesaTransactionDate: transactionDate,
        updatedAt: serverTimestamp(),
      });

      // Update Project status to 'paid' so the buyer can access it
      const projectRef = doc(db, 'projects', transactionData.projectId);
      await updateDoc(projectRef, {
        status: 'paid',
        paymentStatus: 'success',
        lastUpdated: serverTimestamp(),
      });

      // 3. Update Creator's Balance
      const creatorRef = doc(db, 'users', transactionData.creatorUid);
      const earnings = transactionData.creatorEarnings || 0;
      
      // Use setDoc with merge in case the user doc doesn't exist yet
      await setDoc(creatorRef, {
        balance: increment(earnings),
        totalSales: increment(1)
      }, { merge: true });

      console.log(`✅ Payment Successful: ${mpesaReceiptNumber} for Project ${transactionData.projectId}. Creator earnings KSh ${earnings} added.`);
    } else {
      // 3. Handle Failure/Cancellation
      await updateDoc(transactionRef, {
        status: 'failed',
        failureReason: ResultDesc,
        resultCode: ResultCode,
        updatedAt: serverTimestamp(),
      });
      
      // Also reset project status so it's not stuck on "paying"
      if (transactionData.projectId) {
        const projectRef = doc(db, 'projects', transactionData.projectId);
        await updateDoc(projectRef, {
          status: 'active',
          lastUpdated: serverTimestamp(),
        });
      }

      console.log(`❌ Payment Failed: ${ResultDesc}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Callback Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
