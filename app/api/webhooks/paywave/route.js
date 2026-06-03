import { NextResponse } from 'next/server';
import { db } from '../../../../lib/firebase';
import { collection, query, where, getDocs, updateDoc, setDoc, doc, serverTimestamp, increment } from 'firebase/firestore';

/**
 * Paywave Express Payment Webhook / Callback
 * Handles both:
 *  - GET: redirect callback from Paywave after customer completes payment on their hosted page
 *  - POST: background server-to-server payment notification from Paywave
 */

async function handlePaywaveConfirmation(reference, status, paywaveTransactionId) {
  if (!reference) return { ok: false, message: 'No reference' };

  // Find the transaction in Firestore by reference
  const q = query(collection(db, 'transactions'), where('reference', '==', reference));
  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) return { ok: false, message: 'Transaction not found' };

  const transactionDoc = querySnapshot.docs[0];
  const transactionData = transactionDoc.data();

  // Prevent double processing
  if (transactionData.status === 'completed') return { ok: true, message: 'Already completed', projectId: transactionData.projectId };

  const normalizedStatus = (status || '').toString().toLowerCase();
  const isSuccess = !status || 
                    normalizedStatus === 'success' || 
                    normalizedStatus === 'successful' || 
                    normalizedStatus === 'completed' || 
                    normalizedStatus === '0' ||
                    normalizedStatus === 'approved';

  if (isSuccess) {
    // Mark transaction as completed
    await updateDoc(doc(db, 'transactions', transactionDoc.id), {
      status: 'completed',
      paywaveTransactionId: paywaveTransactionId || null,
      paidAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Mark the associated project as paid/active
    if (transactionData.projectId) {
      const projectRef = doc(db, 'projects', transactionData.projectId);
      await updateDoc(projectRef, {
        status: 'paid',
        paidAt: serverTimestamp(),
        sales: increment(1),
        lastUpdated: serverTimestamp(),
      });
    }

    // 🔥 UPDATE CREATOR'S BALANCE (This was missing!)
    const creatorRef = doc(db, 'users', transactionData.creatorUid);
    const earnings = transactionData.creatorEarnings || 0;
    
    // Use setDoc with merge in case the user doc doesn't exist yet
    await setDoc(creatorRef, {
      balance: increment(earnings),
      totalSales: increment(1)
    }, { merge: true });

    console.log(`✅ Payment Successful for Reference: ${transactionData.reference}. Creator earnings KSh ${earnings} added.`);
    return { ok: true, message: 'Transaction completed', projectId: transactionData.projectId };
  } else {
    await updateDoc(doc(db, 'transactions', transactionDoc.id), {
      status: 'failed',
      failureReason: status || 'Payment failed',
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

    console.log(`❌ Payment Failed for Reference: ${transactionData.reference}`);
    return { ok: false, message: 'Payment failed', projectId: transactionData.projectId };
  }
}

// GET: Paywave redirects the browser here after payment
export async function GET(request) {
  let projectId = '';
  try {
    const { searchParams } = new URL(request.url);
    const reference = searchParams.get('ref') || searchParams.get('reference');
    const status    = searchParams.get('status');
    const txId      = searchParams.get('transaction_id') || searchParams.get('txid');

    const result = await handlePaywaveConfirmation(reference, status, txId);
    projectId = result.projectId || '';

    // Redirect customer to their download/success page
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://lipapata.co.ke';
    const normalizedStatus = (status || '').toString().toLowerCase();
    const isSuccess = !status || 
                      normalizedStatus === 'success' || 
                      normalizedStatus === 'successful' || 
                      normalizedStatus === 'completed' || 
                      normalizedStatus === '0' ||
                      normalizedStatus === 'approved';
    const redirectUrl = isSuccess
      ? `${baseUrl}/paywave/callback?ref=${reference}&status=success&projectId=${projectId}`
      : `${baseUrl}/paywave/callback?ref=${reference}&status=failed&projectId=${projectId}`;

    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error('Paywave GET Webhook Error:', error);
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://lipapata.co.ke';
    return NextResponse.redirect(projectId ? `${baseUrl}/p/${projectId}?error=server_error` : `${baseUrl}/login`);
  }
}

// POST: Background server-to-server notification from Paywave
export async function POST(request) {
  try {
    let payload;
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const text = await request.text();
      payload = Object.fromEntries(new URLSearchParams(text));
    } else {
      payload = await request.json();
    }
    
    console.log('PayWave Webhook Payload received:', JSON.stringify(payload));

    // PayWave sends PascalCase keys. Reference is in TransactionReference.
    // ResponseCode: 0 means success (NOT a truthy value — use explicit check!)
    const reference = payload.reference || payload.TransactionReference || payload.transaction_reference;
    const transaction_id = payload.TransactionReceipt || payload.TransactionID || payload.transaction_id;

    // ResponseCode of 0 OR ResponseDescription of "Success" means payment succeeded
    const responseCode = payload.ResponseCode ?? payload.ResultCode;
    const responseDesc = (payload.ResponseDescription || payload.ResultDesc || payload.status || '').toLowerCase();
    const isSuccess = responseCode === 0 || responseCode === '0' ||
      responseDesc.includes('success') ||
      payload.TransactionStatus === 'Completed';

    const status = isSuccess ? 'success' : 'failed';

    const result = await handlePaywaveConfirmation(reference, status, transaction_id);

    if (!result.ok && result.message === 'Transaction not found') {
      return new NextResponse('Transaction not found', { status: 404 });
    }

    return new NextResponse('OK', { status: 200 });
  } catch (error) {
    console.error('Paywave POST Webhook Error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
