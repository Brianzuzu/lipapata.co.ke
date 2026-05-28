import { NextResponse } from 'next/server';
import { doc, getDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../../../../lib/firebase';

export async function GET(req, { params }) {
  const { id } = params;

  if (!id) {
    return NextResponse.json({ error: 'Missing Project ID' }, { status: 400 });
  }

  try {
    const docRef = doc(db, 'projects', id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const data = docSnap.data();

    // Increment views (non-blocking)
    updateDoc(docRef, { views: increment(1) }).catch(err => console.error('Failed to update views:', err));

    // Filter out sensitive fields
    const { 
      originalUrl, 
      originalPublicId, 
      ...publicData 
    } = data;

    return NextResponse.json({
      id: docSnap.id,
      ...publicData
    });
  } catch (error) {
    console.error('Fetch Project Error:', error);
    return NextResponse.json({ error: 'Failed to fetch project details' }, { status: 500 });
  }
}
