import { NextResponse } from 'next/server';
import { db } from '../../../../lib/firebase';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { initiatePaywavePayout } from '../../../../lib/paywave';

/**
 * Admin Payout Route
 * Triggers Paywave Express Payout to pay a creator via M-Pesa or Bank
 */
export async function POST(request) {
  try {
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

    // 3. Initiate Payout via Paywave Express
    console.log(`💸 Initiating Paywave Payout: KSh ${netPayout} (Original: ${amount}, Fee: ${transferFee}) to ${withdrawal.phoneNumber}`);
    const payoutResponse = await initiatePaywavePayout(
      netPayout,
      withdrawal.phoneNumber,
      `Lipapata Payout for ${withdrawal.creatorName || 'Creator'}`
    );

    if (!payoutResponse.status) {
      return NextResponse.json({ error: payoutResponse.message || 'Paywave payout failed' }, { status: 400 });
    }

    // 4. Update the withdrawal request status to 'processing'
    await updateDoc(withdrawalRef, {
      status: 'processing',
      initiatedAt: serverTimestamp(),
      paywavePayoutId: payoutResponse.data.id || null,
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
