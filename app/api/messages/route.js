import { NextResponse } from 'next/server';
import { db } from '../../../lib/firebase';
import { collection, addDoc, getDocs, query, where, orderBy, serverTimestamp } from 'firebase/firestore';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');
    const submissionId = searchParams.get('submissionId');
    const type = searchParams.get('type') || 'public_qa';

    if (!taskId && !submissionId) {
      return NextResponse.json({ error: 'taskId or submissionId is required' }, { status: 400 });
    }

    let q;
    if (submissionId) {
      q = query(
        collection(db, 'task_messages'),
        where('submissionId', '==', submissionId),
        orderBy('createdAt', 'asc')
      );
    } else {
      q = query(
        collection(db, 'task_messages'),
        where('taskId', '==', taskId),
        where('type', '==', type),
        orderBy('createdAt', 'asc')
      );
    }

    const snapshot = await getDocs(q);
    const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return NextResponse.json({ success: true, messages });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { taskId, submissionId, type, senderUid, senderName, content } = body;

    if (!taskId || !senderUid || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const docRef = await addDoc(collection(db, 'task_messages'), {
      taskId,
      submissionId: submissionId || null,
      type: type || 'public_qa',
      senderUid,
      senderName: senderName || 'User',
      content,
      createdAt: serverTimestamp()
    });

    return NextResponse.json({ success: true, messageId: docRef.id });
  } catch (error) {
    console.error('Error posting message:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
