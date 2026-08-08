import { NextResponse } from 'next/server';
import { db } from '../../../../lib/firebase';
import { doc, getDoc, updateDoc, increment, collection, addDoc, serverTimestamp } from 'firebase/firestore';

// Level thresholds
const LEVEL_THRESHOLDS = [
  { level: 1, minEarnings: 0,      minTasks: 0,  minRating: 0 },
  { level: 2, minEarnings: 5000,   minTasks: 3,  minRating: 4.0 },
  { level: 3, minEarnings: 50000,  minTasks: 15, minRating: 4.5 },
  { level: 4, minEarnings: 200000, minTasks: 30, minRating: 4.8 },
];

function calculateLevel(totalEarnings, totalTasksUnlocked, avgRating) {
  let newLevel = 1;
  for (const threshold of LEVEL_THRESHOLDS) {
    if (
      totalEarnings >= threshold.minEarnings &&
      totalTasksUnlocked >= threshold.minTasks &&
      avgRating >= threshold.minRating
    ) {
      newLevel = threshold.level;
    }
  }
  return newLevel;
}

export async function POST(request) {
  try {
    const { submissionId, taskId, creatorUid, rating } = await request.json();

    if (!submissionId || !taskId || !creatorUid || !rating) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const ratingValue = parseInt(rating);
    if (ratingValue < 1 || ratingValue > 5) {
      return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 });
    }

    // Get creator's current data
    const creatorRef = doc(db, 'users', creatorUid);
    const creatorSnap = await getDoc(creatorRef);

    if (!creatorSnap.exists()) {
      return NextResponse.json({ error: 'Creator not found' }, { status: 404 });
    }

    const creatorData = creatorSnap.data();
    const currentRatingSum = creatorData.ratingSum || 0;
    const currentRatingCount = creatorData.ratingCount || 0;
    const currentTasks = creatorData.totalTasksUnlocked || 0;
    const currentEarnings = creatorData.totalEarnings || 0;

    // New rating aggregate
    const newRatingSum = currentRatingSum + ratingValue;
    const newRatingCount = currentRatingCount + 1;
    const newAvgRating = newRatingSum / newRatingCount;

    // Also increment task count here if not done at payment time
    const newTaskCount = currentTasks + 1;

    // Calculate new level
    const newLevel = calculateLevel(currentEarnings, newTaskCount, newAvgRating);

    // Update creator document
    await updateDoc(creatorRef, {
      ratingSum: newRatingSum,
      ratingCount: newRatingCount,
      totalTasksUnlocked: newTaskCount,
      creatorLevel: newLevel,
    });

    // Save the rating as a separate document (for audit trail)
    await addDoc(collection(db, 'ratings'), {
      creatorUid,
      taskId,
      submissionId,
      rating: ratingValue,
      createdAt: serverTimestamp(),
    });

    // Mark submission as rated
    await updateDoc(doc(db, 'task_submissions', submissionId), {
      rated: true,
      rating: ratingValue,
    });

    const leveledUp = newLevel > (creatorData.creatorLevel || 1);

    return NextResponse.json({
      success: true,
      newAvgRating: Math.round(newAvgRating * 10) / 10,
      newLevel,
      leveledUp,
    });
  } catch (err) {
    console.error('Error submitting rating:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
