import { NextResponse } from 'next/server';
import { db } from '../../../../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export async function GET() {
  try {
    const docSnap = await getDoc(doc(db, 'settings', 'global'));
    if (docSnap.exists()) {
      return NextResponse.json(docSnap.data());
    }
    return NextResponse.json({
      globalCommission: 0.03,
      minWithdrawal: 500,
      maxWithdrawal: 100000,
      dailyWithdrawalLimit: 1
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}
