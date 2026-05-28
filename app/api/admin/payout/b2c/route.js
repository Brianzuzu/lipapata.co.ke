import { NextResponse } from 'next/server';
import { db } from '../../../../../lib/firebase';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Mock B2C Admin Payout Route
 * This is an interim solution while waiting for the Safaricom B2C API keys.
 * It simulates the Maker-Checker process and secures the endpoint.
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

    // 2. Maker-Checker validation: ensure it's pending
    if (withdrawal.status !== 'pending' && withdrawal.status !== 'failed') {
      return NextResponse.json({ error: 'Withdrawal already processed or not in pending state' }, { status: 400 });
    }

    // 3. (Future) Security: IP Whitelisting Check could go here
    // const clientIp = request.headers.get('x-forwarded-for') || request.ip;
    // if (clientIp !== process.env.WHITELISTED_IP) throw new Error("Unauthorized IP");

    // 4. (Future) Safaricom B2C API Call would happen here
    console.log(`[MOCK] Initiating B2C Transfer to ${withdrawal.phoneNumber} for KSh ${withdrawal.netAmount}`);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    // 5. Update the withdrawal request status to 'completed' (or 'processing' if async)
    await updateDoc(withdrawalRef, {
      status: 'completed', // In real B2C, this might be 'processing' until webhook callback
      b2cInitiatedAt: serverTimestamp(),
      b2cConversationId: `mock_b2c_${Date.now()}` // Mock ID
    });

    return NextResponse.json({
      success: true,
      message: 'B2C Payout initiated successfully (Mock)',
      data: { conversationId: `mock_b2c_${Date.now()}` }
    });

  } catch (error) {
    console.error('B2C Payout Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
