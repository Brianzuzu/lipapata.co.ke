import { NextResponse } from 'next/server';
import { db } from '../../../../lib/firebase';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { initiatePaywavePayout } from '../../../../lib/paywave';
import { verifyAdminRequest } from '../../../../lib/adminAuth';

/**
 * Admin Payout Route
 * Triggers Paywave Express Payout to pay a creator via M-Pesa or Bank
 */
export async function POST(request) {
  try {
    const auth = verifyAdminRequest(request);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const { withdrawalId } = await request.json();

    if (!withdrawalId) {
      return NextResponse.json({ error: 'Missing withdrawal ID' }, { status: 400 });
    }

    // 1. Fetch the withdrawal request
    const withdrawalRef = doc(db, 'withdrawals', withdrawalId);
    const withdrawalSnap = await getDoc(withdrawalRef);

    if (!withdrawalSnap.exists()) {
      return NextResponse.json({ error: 'Withdrawal request not found' }, { status: 404 });
    }

    const withdrawal = withdrawalSnap.data();

    if (withdrawal.status !== 'pending' && withdrawal.status !== 'failed') {
      return NextResponse.json({ error: 'Withdrawal already processed or in progress' }, { status: 400 });
    }

    // 2. Calculate dynamic Transfer Fee based on 2026 tiers
    const amount = withdrawal.amount;
    let transferFee = 20; // Default for < 1,500
    if (amount > 20000) {
      transferFee = 60;
    } else if (amount > 1500) {
      transferFee = 40;
    }

    const netPayout = amount - transferFee;

    if (netPayout <= 0) {
      return NextResponse.json({ error: 'Withdrawal amount too small to cover transfer fees' }, { status: 400 });
    }

    // 3. Fetch creator email from Firestore (required by OpenFloat API)
    let creatorEmail = withdrawal.creatorEmail || null;
    if (!creatorEmail && withdrawal.creatorUid) {
      try {
        const userSnap = await getDoc(doc(db, 'users', withdrawal.creatorUid));
        if (userSnap.exists()) {
          creatorEmail = userSnap.data().email || null;
        }
      } catch (emailErr) {
        console.warn('Could not fetch creator email:', emailErr.message);
      }
    }

    if (!creatorEmail) {
      return NextResponse.json(
        { error: 'Creator email not found. The OpenFloat payment API requires a registered email address. Please ensure the creator has a registered email in their profile.' },
        { status: 400 }
      );
    }

    // 4. Initiate Payout via Paywave Express
    console.log(`💸 Initiating Paywave Payout: KSh ${netPayout} (Original: ${amount}, Fee: ${transferFee}) to ${withdrawal.phoneNumber} (${creatorEmail})`);
    const payoutResponse = await initiatePaywavePayout(
      netPayout,
      withdrawal.phoneNumber,
      creatorEmail,
      `Lipapata Payout for ${withdrawal.creatorName || 'Creator'}`
    );

    if (!payoutResponse.status) {
      return NextResponse.json({ error: payoutResponse.message || 'Paywave payout failed' }, { status: 400 });
    }

    // 5. Update the withdrawal request status to 'processing'
    await updateDoc(withdrawalRef, {
      status: 'processing',
      initiatedAt: serverTimestamp(),
      paywavePayoutId: payoutResponse.data?.id || null,
      creatorEmailUsed: creatorEmail,
    });

    return NextResponse.json({
      success: true,
      message: 'Payout initiated successfully via Paywave Express',
      transferData: payoutResponse.data
    });

  } catch (error) {
    console.error('Payout Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
