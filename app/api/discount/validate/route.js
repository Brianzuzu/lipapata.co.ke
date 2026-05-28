import { NextResponse } from 'next/server';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../../lib/firebase';

export async function POST(req) {
  try {
    const { projectId, code } = await req.json();

    if (!projectId || !code) {
      return NextResponse.json({ error: 'Missing projectId or code' }, { status: 400 });
    }

    const discountsRef = collection(db, 'discounts');
    const q = query(
      discountsRef, 
      where('projectId', '==', projectId), 
      where('code', '==', code.toUpperCase()),
      where('active', '==', true)
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return NextResponse.json({ error: 'Invalid or expired discount code.' }, { status: 404 });
    }

    const discountData = snapshot.docs[0].data();

    return NextResponse.json({
      success: true,
      discount: {
        type: discountData.type, // 'percentage' or 'fixed'
        value: discountData.value
      }
    });

  } catch (error) {
    console.error('Discount validation error:', error);
    return NextResponse.json({ error: 'Failed to validate discount.' }, { status: 500 });
  }
}
