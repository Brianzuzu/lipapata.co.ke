import { NextResponse } from 'next/server';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';

export async function POST(req) {
  try {
    const body = await req.json();
    const { recipientUid, type, title, message, link } = body || {};

    await addDoc(collection(db, 'notifications'), {
      recipientUid: recipientUid || '',
      type: type || '',
      title: title || '',
      message: message || '',
      link: link || '',
      read: false,
      createdAt: serverTimestamp()
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Notify API error:', error);
    return NextResponse.json({ error: 'Failed to create notification' }, { status: 500 });
  }
}
