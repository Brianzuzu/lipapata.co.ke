import { NextResponse } from 'next/server';
import { db } from '../../../../lib/firebase';
import { collection, query, where, getDocs, updateDoc, setDoc, doc, serverTimestamp, increment } from 'firebase/firestore';
import { checkPaywaveTransactionStatus } from '../../../../lib/paywave';

export const dynamic = 'force-dynamic';

/**
 * Paywave Express Payment Webhook / Callback
 * Handles both:
 *  - GET: redirect callback from Paywave after customer completes payment on their hosted page
 *  - POST: background server-to-server payment notification from Paywave
 */

async function handlePaywaveConfirmation(reference, status, paywaveTransactionId) {
  console.log(`[PAYWAVE] handlePaywaveConfirmation called: ref=${reference}, status=${status}, txId=${paywaveTransactionId}`);
  
  if (!reference) return { ok: false, message: 'No reference' };

  // Find the transaction in Firestore by reference
  const q = query(collection(db, 'transactions'), where('reference', '==', reference));
  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    console.log(`[PAYWAVE] ❌ Transaction NOT found for reference: ${reference}`);
    return { ok: false, message: 'Transaction not found' };
  }

  const transactionDoc = querySnapshot.docs[0];
  const transactionData = transactionDoc.data();

  console.log(`[PAYWAVE] Found transaction ${transactionDoc.id}, current status: ${transactionData.status}`);

  // Prevent double processing
  if (transactionData.status === 'completed') {
    console.log(`[PAYWAVE] Already completed, skipping.`);
    return { ok: true, message: 'Already completed', projectId: transactionData.projectId };
  }

  const normalizedStatus = (status || '').toString().toLowerCase().trim();
  const isSuccess = !status || 
                    normalizedStatus === 'success' || 
                    normalizedStatus === 'successful' || 
                    normalizedStatus === 'completed' || 
                    normalizedStatus === '0' ||
                    normalizedStatus === 'approved' ||
                    normalizedStatus === 'paid';

  console.log(`[PAYWAVE] normalizedStatus="${normalizedStatus}", isSuccess=${isSuccess}`);

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

    // UPDATE CREATOR'S BALANCE
    const creatorRef = doc(db, 'users', transactionData.creatorUid);
    const earnings = transactionData.creatorEarnings || 0;
    
    await setDoc(creatorRef, {
      balance: increment(earnings),
      totalSales: increment(1)
    }, { merge: true });

    console.log(`[PAYWAVE] ✅ Payment Successful for Reference: ${transactionData.reference}. Creator earnings KSh ${earnings} added.`);
    return { ok: true, message: 'Transaction completed', projectId: transactionData.projectId };

  } else {
    await updateDoc(doc(db, 'transactions', transactionDoc.id), {
      status: 'failed',
      failureReason: status || 'Payment failed',
      updatedAt: serverTimestamp(),
    });
    
    // Reset project status so it's not stuck on "paying"
    if (transactionData.projectId) {
      const projectRef = doc(db, 'projects', transactionData.projectId);
      await updateDoc(projectRef, {
        status: 'active',
        lastUpdated: serverTimestamp(),
      });
    }

    console.log(`[PAYWAVE] ❌ Payment Failed for Reference: ${transactionData.reference}, status: ${status}`);
    return { ok: false, message: 'Payment failed', projectId: transactionData.projectId };
  }
}

// GET: Paywave redirects the browser here after payment (browser redirect callback)
export async function GET(request) {
  let projectId = '';
  try {
    const { searchParams } = new URL(request.url);
    const reference = searchParams.get('ref') || searchParams.get('reference') || searchParams.get('order_id') || searchParams.get('orderid');
    const status    = searchParams.get('status') || searchParams.get('Status');
    const txId      = searchParams.get('transaction_id') || searchParams.get('txid') || searchParams.get('TransactionID');

    console.log(`[PAYWAVE GET] ref=${reference}, status=${status}, txId=${txId}, fullUrl=${request.url}`);

    // Secure verification check:
    let verifiedStatus = status;
    let verifiedTxId = txId;

    if (reference) {
      const q = query(collection(db, 'transactions'), where('reference', '==', reference));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const transDoc = querySnapshot.docs[0];
        const transData = transDoc.data();

        if (transData.status === 'completed') {
          verifiedStatus = 'success';
        } else if (transData.transactionRequestId) {
          try {
            console.log(`[PAYWAVE GET] Verifying with PayWave API for transactionRequestId: ${transData.transactionRequestId}`);
            const apiRes = await checkPaywaveTransactionStatus(transData.transactionRequestId);
            console.log(`[PAYWAVE GET] PayWave API status check response:`, JSON.stringify(apiRes));

            const isApiSuccess = apiRes && (
              apiRes.status === 'success' || 
              apiRes.status === 'completed' || 
              apiRes.status === 'successful' || 
              apiRes.resultCode === 0 || 
              apiRes.resultCode === '0' ||
              apiRes.ResultCode === '0' ||
              apiRes.ResultCode === 0 ||
              apiRes.success === true ||
              apiRes.ResponseCode === '00' ||
              apiRes.ResponseCode === '0'
            );

            if (isApiSuccess) {
              verifiedStatus = 'success';
              verifiedTxId = apiRes.transaction_id || apiRes.transactionId || apiRes.Receipt || txId || 'PWX-VERIFIED';
            } else {
              console.log(`[PAYWAVE GET] PayWave API check did not confirm success. apiRes:`, apiRes);
              verifiedStatus = 'failed';
            }
          } catch (apiError) {
            console.error('[PAYWAVE GET] PayWave API verification failed:', apiError);
            verifiedStatus = 'failed';
          }
        } else {
          console.log(`[PAYWAVE GET] No transactionRequestId found in Firestore. Falling back to URL status.`);
        }
      }
    }

    const result = await handlePaywaveConfirmation(reference, verifiedStatus, verifiedTxId);
    projectId = result.projectId || '';

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://lipapata.co.ke';
    const normalizedStatus = (verifiedStatus || '').toString().toLowerCase();
    const isSuccess = result.ok || 
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
    console.error('[PAYWAVE GET] Error:', error);
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://lipapata.co.ke';
    return NextResponse.redirect(projectId ? `${baseUrl}/p/${projectId}` : `${baseUrl}/`);
  }
}

// POST: Background server-to-server notification from Paywave
export async function POST(request) {
  try {
    let payload;
    let rawBody = '';
    const contentType = request.headers.get('content-type') || '';
    
    if (contentType.includes('application/x-www-form-urlencoded')) {
      rawBody = await request.text();
      payload = Object.fromEntries(new URLSearchParams(rawBody));
    } else {
      rawBody = await request.text();
      try {
        payload = JSON.parse(rawBody);
      } catch {
        payload = Object.fromEntries(new URLSearchParams(rawBody));
      }
    }
    
    // Log the FULL raw payload so we can see exactly what PayWave sends
    console.log('[PAYWAVE POST] Raw body:', rawBody);
    console.log('[PAYWAVE POST] Parsed payload:', JSON.stringify(payload));
    console.log('[PAYWAVE POST] Content-Type:', contentType);
    console.log('[PAYWAVE POST] All keys:', Object.keys(payload).join(', '));

    // Try every possible field name PayWave might use for the reference
    const reference = 
      payload.reference || 
      payload.Reference ||
      payload.TransactionReference || 
      payload.transaction_reference ||
      payload.order_id ||
      payload.orderid ||
      payload.OrderID ||
      payload.ref;

    const transaction_id = 
      payload.TransactionReceipt || 
      payload.TransactionID || 
      payload.transaction_id ||
      payload.receipt ||
      payload.mpesa_receipt;

    // Try every possible field name for the status/result
    const responseCode = 
      payload.ResponseCode ?? 
      payload.ResultCode ?? 
      payload.responseCode ?? 
      payload.resultCode ??
      payload.code;

    const responseDesc = (
      payload.ResponseDescription || 
      payload.ResultDesc || 
      payload.status || 
      payload.Status ||
      payload.TransactionStatus || 
      payload.message ||
      payload.description ||
      ''
    ).toString().toLowerCase();
    
    console.log(`[PAYWAVE POST] reference="${reference}", responseCode="${responseCode}", responseDesc="${responseDesc}"`);

    const isSuccess = 
      responseCode === 0 || 
      responseCode === '0' ||
      responseCode === '00' ||
      responseDesc.includes('success') ||
      responseDesc.includes('completed') ||
      responseDesc.includes('paid') ||
      responseDesc.includes('approved');

    const status = isSuccess ? 'success' : 'failed';
    console.log(`[PAYWAVE POST] isSuccess=${isSuccess}, treating as status="${status}"`);

    const result = await handlePaywaveConfirmation(reference, status, transaction_id);
    console.log('[PAYWAVE POST] Result:', JSON.stringify(result));

    if (!result.ok && result.message === 'Transaction not found') {
      return new NextResponse('Transaction not found', { status: 404 });
    }

    return new NextResponse('OK', { status: 200 });
  } catch (error) {
    console.error('[PAYWAVE POST] Error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
