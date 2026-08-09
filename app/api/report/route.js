import { NextResponse } from 'next/server';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';

export async function POST(req) {
  try {
    const body = await req.json();
    const { reportedType, reportedId, reportedUid, reporterUid, reason, description } = body || {};

    await addDoc(collection(db, 'reports'), {
      reportedType: reportedType || '',
      reportedId: reportedId || '',
      reportedUid: reportedUid || '',
      reporterUid: reporterUid || '',
      reason: reason || '',
      description: description || '',
      status: 'pending',
      createdAt: serverTimestamp()
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Report API error:', error);
    return NextResponse.json({ error: 'Failed to create report' }, { status: 500 });
  }
}
