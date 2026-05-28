import { NextResponse } from 'next/server';
import { db } from '../../../../../lib/firebase';
import { collection, query, where, getDocs, updateDoc, doc, serverTimestamp, increment } from 'firebase/firestore';

/**
 * M-Pesa B2C Result Callback
 * Receives the final status of a payout request
 */
export async function POST(request) {
  try {
    const body = await request.json();
    console.log('📬 Received M-Pesa B2C Callback:', JSON.stringify(body, null, 2));

    const result = body.Result;
    if (!result) {
      return NextResponse.json({ error: 'Invalid callback payload' }, { status: 400 });
    }

    const { 
      ResultCode, 
      ResultDesc, 
      ConversationID, 
      OriginatorConversationID,
      ResultParameters 
    } = result;

    // 1. Find the corresponding withdrawal request
    // We use ConversationID or OriginatorConversationID to match
    const withdrawalsRef = collection(db, 'withdrawals');
    const q = query(
      withdrawalsRef, 
      where('conversationId', '==', ConversationID),
      where('status', '==', 'processing')
    );
    
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      console.warn(`⚠️ No pending withdrawal found for ConversationID: ${ConversationID}`);
      return NextResponse.json({ message: 'No matching withdrawal found' });
    }

    const withdrawalDoc = snapshot.docs[0];
    const withdrawal = withdrawalDoc.data();
    const withdrawalRef = doc(db, 'withdrawals', withdrawalDoc.id);

    if (ResultCode === 0) {
      // SUCCESS
      console.log(`✅ Payout Successful for Withdrawal ${withdrawalDoc.id}`);
      
      const mpesaReceipt = ResultParameters?.ResultParameter?.find(p => p.Key === 'TransactionID')?.Value;

      await updateDoc(withdrawalRef, {
        status: 'completed',
        processedAt: serverTimestamp(),
        mpesaReceipt: mpesaReceipt || 'N/A',
        resultDesc: ResultDesc
      });

      // Update creator's total payouts or other stats if needed
      const creatorRef = doc(db, 'users', withdrawal.creatorUid);
      // We don't deduct balance here because it should have been deducted when the request was made
      // But we can update 'totalWithdrawn'
      await updateDoc(creatorRef, {
        totalWithdrawn: increment(withdrawal.amount)
      });

    } else {
      // FAILURE
      console.error(`❌ Payout Failed for Withdrawal ${withdrawalDoc.id}: ${ResultDesc}`);
      
      await updateDoc(withdrawalRef, {
        status: 'failed',
        processedAt: serverTimestamp(),
        errorCode: ResultCode,
        errorDesc: ResultDesc
      });

      // Refund the creator's balance since the payout failed
      const creatorRef = doc(db, 'users', withdrawal.creatorUid);
      await updateDoc(creatorRef, {
        balance: increment(withdrawal.amount)
      });
    }

    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Success' });

  } catch (error) {
    console.error('B2C Callback Error:', error);
    return NextResponse.json({ ResultCode: 1, ResultDesc: 'Internal error' });
  }
}
