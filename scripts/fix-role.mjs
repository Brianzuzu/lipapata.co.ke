import fs from 'fs';
import { initializeApp } from "firebase/app";
import { getFirestore, doc, updateDoc } from "firebase/firestore";

const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
  const [k, ...v] = line.split('=');
  if (k && v) acc[k.trim()] = v.join('=').trim().replace(/^['"]|['"]$/g, '');
  return acc;
}, {});

const firebaseConfig = {
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function fixRole() {
  console.log("Updating role of user aFHZzUnFzOSz8ywmDU1QCfbPMvq1 to 'admin'...");
  const userRef = doc(db, 'users', 'aFHZzUnFzOSz8ywmDU1QCfbPMvq1');
  await updateDoc(userRef, {
    role: 'admin'
  });
  console.log("Successfully fixed user role in Firestore!");
  process.exit(0);
}

fixRole().catch(err => {
  console.error(err);
  process.exit(1);
});
