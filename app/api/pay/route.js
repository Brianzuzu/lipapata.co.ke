import { NextResponse } from 'next/server';
import { doc, getDoc, addDoc, updateDoc, collection, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { calculateCommission } from '../../../lib/commission';
import { initiatePaywaveDirectStkPush } from '../../../lib/paywave';
import { getGlobalSettings } from '../../../lib/settings';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { projectId, amount, phoneNumber, email, discountCode } = await request.json();

    if (!projectId || !amount || !phoneNumber || !email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Ensure phone number is in the correct format (2547XXXXXXXX)
    let formattedPhone = phoneNumber.replace(/[\s+]/g, '');
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '254' + formattedPhone.slice(1);
    } else if (formattedPhone.startsWith('7') || formattedPhone.startsWith('1')) {
      formattedPhone = '254' + formattedPhone;
    }

    // 1. Fetch the project
    const projectRef = doc(db, 'projects', projectId);
    const projectSnap = await getDoc(projectRef);

    if (!projectSnap.exists()) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const project = projectSnap.data();
    const creatorPlan = project.creatorPlan || 'FREE';

    // Ensure the amount paid is at least the minimum project price
    let amountToCharge = parseFloat(project.price || 0);

    // Apply discount if provided
    let appliedDiscount = null;
    if (discountCode) {
      const q = query(
        collection(db, 'discounts'),
        where('projectId', '==', projectId),
        where('code', '==', discountCode.toUpperCase()),
        where('active', '==', true)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const discountData = snapshot.docs[0].data();
        if (discountData.type === 'percentage') {
          amountToCharge = amountToCharge - (amountToCharge * (discountData.value / 100));
        } else if (discountData.type === 'fixed') {
          amountToCharge = Math.max(0, amountToCharge - discountData.value);
        }
        appliedDiscount = discountCode.toUpperCase();
      }
    }

    if (project.isPWYW && amount && parseFloat(amount) >= amountToCharge) {
      amountToCharge = parseFloat(amount);
    } else if (amount && parseFloat(amount) < amountToCharge) {
      return NextResponse.json({ error: 'Amount is below the minimum price.' }, { status: 400 });
    }

    // 2. Fetch global settings
    const settings = await getGlobalSettings();
    const customRate = settings?.globalCommission;

    // 3. Calculate commission
    const breakdown = calculateCommission(amountToCharge, creatorPlan, customRate);

    // 4. Generate unique reference
    const reference = `LIPA-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // 5. Create a pending transaction record in Firestore FIRST
    const transactionRef = await addDoc(collection(db, 'transactions'), {
      projectId,
      title: project.title || 'Digital Asset',
      creatorUid: project.uid,
      creatorName: project.creatorName || 'Creator',
      phoneNumber: formattedPhone,
      email,
      totalAmount: breakdown.total,
      platformFee: breakdown.platformFee,
      paymentGatewayFee: breakdown.paymentGatewayFee,
      commissionRate: breakdown.commissionRate,
      creatorEarnings: breakdown.creatorEarnings,
      reference,
      status: 'pending',
      discountCode: appliedDiscount || null,
      customerEmail: email,
      gateway: 'paywave',
      createdAt: serverTimestamp(),
    });

    // 6. Update the project status to 'paying'
    await updateDoc(projectRef, {
      status: 'paying',
      lastTransactionId: transactionRef.id,
      lastReference: reference,
    });

    // 7. Initiate the direct STK Push — sends M-Pesa prompt to user's phone
    console.log(`[PAY] Initiating STK Push for ref=${reference}, phone=${formattedPhone}, amount=${breakdown.total}`);
    
    let stkResponse;
    try {
      stkResponse = await initiatePaywaveDirectStkPush({
        email,
        amount: breakdown.total,
        phoneNumber: formattedPhone,
        reference,
      });
      console.log('[PAY] STK Push Response:', JSON.stringify(stkResponse));
      
      // Update transaction with the Paywave request ID
      // Paywave returns: { ResponseCode: "0", success: "200", transaction_request_id: "FCID...", ... }
      const txReqId = stkResponse?.transaction_request_id || stkResponse?.id || stkResponse?.TransactionId || null;
      await updateDoc(transactionRef, {
        transactionRequestId: txReqId,
        stkResponseRaw: JSON.stringify(stkResponse)
      });
    } catch (stkError) {
      console.error('[PAY] STK Push Error:', stkError);
      // Clean up — reset project status
      await updateDoc(projectRef, { status: 'active' });
      return NextResponse.json({ error: 'Failed to send M-Pesa prompt. Please try again.' }, { status: 500 });
    }

    // Check if STK push was rejected immediately.
    // Paywave success = ResponseCode "0" (string). Failure = any other code, or explicit error fields.
    const stkResponseCode = stkResponse?.ResponseCode ?? stkResponse?.responseCode;
    const stkFailed =
      stkResponse?.status === false ||
      (stkResponseCode !== undefined && stkResponseCode !== '0' && stkResponseCode !== 0) ||
      (stkResponse?.message && !stkResponse?.transaction_request_id &&
        !String(stkResponse?.message).toLowerCase().includes('please enter'));

    if (stkFailed) {
      await updateDoc(projectRef, { status: 'active' });
      const errMsg = stkResponse?.message || stkResponse?.error || 'Failed to initiate payment';
      return NextResponse.json({ error: errMsg }, { status: 400 });
    }

    // 8. Return the transaction ID so frontend can poll for status
    return NextResponse.json({
      success: true,
      transactionId: transactionRef.id,
      reference,
      breakdown,
      message: 'M-Pesa prompt sent to your phone. Enter your PIN to complete payment.',
    });

  } catch (error) {
    console.error('[PAY] Payment Error:', error);
    return NextResponse.json(
      { error: error.message || 'Payment processing failed' },
      { status: 500 }
    );
  }
}
