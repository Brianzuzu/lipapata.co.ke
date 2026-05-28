import { NextResponse } from 'next/server';
import { db, storage } from '../../../../lib/firebase';
import { collection, query, where, getDocs, deleteDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import cloudinary from '../../../../lib/cloudinary';

export const dynamic = 'force-dynamic';

// Note: To run this automatically, set up Vercel Cron Jobs (vercel.json) or similar scheduling.
export async function GET(req) {
  try {
    // Ensure this route is protected in production!
    const authHeader = req.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Calculate the date 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // 2. Query Firestore for projects that are older than 30 days and have been paid
    const projectsRef = collection(db, 'projects');
    const q = query(
      projectsRef, 
      where('status', '==', 'paid'),
      where('lastUpdated', '<=', thirtyDaysAgo)
    );

    const snapshot = await getDocs(q);
    const deletedFiles = [];

    for (const document of snapshot.docs) {
      const data = document.data();

      // Delete original file from Cloudinary
      if (data.originalPublicId) {
        try {
          await cloudinary.uploader.destroy(data.originalPublicId, { 
            resource_type: data.resourceType || 'image' 
          });
          deletedFiles.push(data.originalPublicId);
          
          // Mark the project as expired so we don't try to delete it again
          const projectRef = doc(db, 'projects', document.id);
          await updateDoc(projectRef, {
            status: 'expired',
            fileRemoved: true,
            expiredAt: serverTimestamp()
          });
        } catch (cloudErr) {
          console.error(`Failed to delete Cloudinary asset ${data.originalPublicId}:`, cloudErr);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Cleanup completed. Deleted ${deletedFiles.length} expired files.`,
      deletedFiles,
    });
  } catch (error) {
    console.error('Cleanup Cron Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
