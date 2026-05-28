import { NextResponse } from 'next/server';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../../lib/firebase';

export async function GET(req, { params }) {
  const { projectId } = params;
  const { searchParams } = new URL(req.url);
  const transactionId = searchParams.get('t');

  if (!projectId || !transactionId) {
    return NextResponse.json({ error: 'Missing Project ID or Transaction ID' }, { status: 400 });
  }

  try {
    // 1. Verify Transaction
    const transRef = doc(db, 'transactions', transactionId);
    const transSnap = await getDoc(transRef);

    if (!transSnap.exists()) {
      return NextResponse.json({ error: 'Invalid transaction' }, { status: 403 });
    }

    const transaction = transSnap.data();

    // Check if transaction matches project and is completed
    if (transaction.projectId !== projectId || (transaction.status !== 'completed' && !transaction.mock)) {
      return NextResponse.json({ error: 'Payment not verified' }, { status: 403 });
    }

    // 2. Fetch Project for the original URL
    const projectRef = doc(db, 'projects', projectId);
    const projectSnap = await getDoc(projectRef);

    if (!projectSnap.exists()) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const project = projectSnap.data();
    
    let url = project.originalUrl;
    let filename = project.fileName || 'download';
    
    const fileIndex = searchParams.get('index');
    if (fileIndex !== null && project.files && project.files[parseInt(fileIndex)]) {
      url = project.files[parseInt(fileIndex)].originalUrl;
      filename = project.files[parseInt(fileIndex)].fileName;
    }

    if (!url) {
      return NextResponse.json({ error: 'Download URL not available' }, { status: 404 });
    }

    // 3. Proxy the download
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get('Content-Type') || 'application/octet-stream';

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('Secure Download Error:', error);
    return NextResponse.json({ error: 'Failed to process download' }, { status: 500 });
  }
}
