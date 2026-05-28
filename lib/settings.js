import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

export async function getGlobalSettings() {
  try {
    const docSnap = await getDoc(doc(db, 'settings', 'global'));
    if (docSnap.exists()) {
      return docSnap.data();
    }
    return {
      globalCommission: 0.05, // 5%
      minWithdrawal: 50
    };
  } catch (err) {
    console.error('Error fetching global settings:', err);
    return {
      globalCommission: 0.05,
      minWithdrawal: 50
    };
  }
}
