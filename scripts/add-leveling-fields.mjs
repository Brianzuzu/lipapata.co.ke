import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

// Construct path to the service account key
const serviceAccountPath = path.resolve('./service-account-key.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error("Error: service-account-key.json not found in the root directory.");
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

// Initialize Firebase Admin
initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function addLevelingFields() {
  console.log("Starting to add leveling fields to all users...");
  try {
    const usersRef = db.collection('users');
    const snapshot = await usersRef.get();
    
    if (snapshot.empty) {
      console.log('No users found.');
      return;
    }

    let batch = db.batch();
    let count = 0;
    let totalUpdated = 0;
    
    snapshot.forEach(doc => {
      const data = doc.data();
      let updates = {};
      
      // Only set if not already present to avoid overwriting existing progress
      if (data.creatorLevel === undefined) updates.creatorLevel = 1;
      if (data.totalTasksUnlocked === undefined) updates.totalTasksUnlocked = 0;
      if (data.totalEarnings === undefined) updates.totalEarnings = 0;
      if (data.ratingSum === undefined) updates.ratingSum = 0;
      if (data.ratingCount === undefined) updates.ratingCount = 0;

      if (Object.keys(updates).length > 0) {
        batch.update(doc.ref, updates);
        count++;
        totalUpdated++;
      }
      
      // Commit in batches of 500 (Firestore limit)
      if (count === 490) { // Keep slightly under 500
        batch.commit();
        batch = db.batch();
        console.log("Committed a batch of 490...");
        count = 0;
      }
    });

    if (count > 0) {
      await batch.commit();
      console.log(`Committed final batch of ${count} users.`);
    }
    
    console.log(`Finished updating users with leveling fields! Total updated: ${totalUpdated}`);
  } catch (error) {
    console.error("Error updating users:", error);
  }
}

addLevelingFields();
