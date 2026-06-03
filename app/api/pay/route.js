import { NextResponse } from 'next/server';
import { doc, getDoc, addDoc, updateDoc, collection, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { calculateCommission } from '../../../lib/commission';
import { buildPaywavePaymentUrl } from '../../../lib/paywave';
import { getGlobalSettings } from '../../../lib/settings';

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
    } else if (formattedPhone.startsWith('7')) {
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

    // 4. Generate unique reference and build Paywave hosted payment URL
    const reference = `LIPA-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const callbackUrl = `${baseUrl}/api/webhooks/paywave`;

    const authorization_url = buildPaywavePaymentUrl({
      customerEmail: email,
      amount: breakdown.total,
      reference,
      phoneNumber: formattedPhone,
      description: project.title || 'Lipapata Digital Content',
      callbackUrl,
    });

    // 5. Create a pending transaction record in Firestore
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

    // 6. Update the project status
    await updateDoc(projectRef, {
      status: 'paying',
      lastTransactionId: transactionRef.id,
      lastReference: reference,
    });

    // 7. Return the hosted payment URL and transaction ID to the frontend
    return NextResponse.json({
      success: true,
      authorization_url,
      reference,
      transactionId: transactionRef.id,
      breakdown,
    });

  } catch (error) {
    console.error('Payment Error:', error);
    return NextResponse.json(
      { error: error.message || 'Payment processing failed' },
      { status: 500 }
    );
  }
}
