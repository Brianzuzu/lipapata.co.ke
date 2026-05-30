import { NextResponse } from 'next/server';
import cloudinary from '../../../../lib/cloudinary';

export async function POST(req) {
  try {
    const timestamp = Math.round((new Date()).getTime() / 1000);
    const folder = 'accessra/originals';

    // Generate secure SHA-1 signature
    const signature = cloudinary.utils.api_sign_request(
      {
        folder,
        timestamp,
      },
      process.env.CLOUDINARY_API_SECRET
    );

    return NextResponse.json({
      success: true,
      signature,
      timestamp,
      apiKey: process.env.CLOUDINARY_API_KEY,
      cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
      folder,
    });
  } catch (error) {
    console.error('❌ Cloudinary signing error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate upload signature' },
      { status: 500 }
    );
  }
}
