import { NextResponse } from 'next/server';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { checkPaywaveTransactionStatus } from '../../../lib/paywave';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const q = query(
      collection(db, 'transactions'),
      orderBy('createdAt', 'desc'),
      limit(5)
    );
    const snapshot = await getDocs(q);
    
    const results = [];
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      let tstatus = null;
      if (data.transactionRequestId) {
        try {
          tstatus = await checkPaywaveTransactionStatus(data.transactionRequestId);
        } catch (e) {
          tstatus = { error: e.message };
        }
      }
      
      results.push({
        id: docSnap.id,
        status: data.status,
        reference: data.reference,
        transactionRequestId: data.transactionRequestId,
        stkResponseRaw: data.stkResponseRaw,
        createdAt: data.createdAt?.toDate?.(),
        tstatus
      });
    }
    
    return NextResponse.json({ success: true, results });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
