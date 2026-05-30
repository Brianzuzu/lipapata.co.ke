import { NextResponse } from 'next/server';
import cloudinary from '../../../../lib/cloudinary';

export async function POST(req) {
  try {
    const { publicId, resourceType, creatorName } = await req.json();

    if (!publicId || !resourceType) {
      return NextResponse.json(
        { error: 'Missing publicId or resourceType' },
        { status: 400 }
      );
    }

    let previewUrl = '';
    const creator = creatorName || 'Creator';

    if (resourceType === 'image') {
      previewUrl = cloudinary.url(publicId, {
        transformation: [
          { width: 1200, crop: 'limit', quality: 'auto', fetch_format: 'auto' },
          {
            overlay: { font_family: 'Arial', font_size: 45, font_weight: 'bold', text: `BY ${creator.toUpperCase()}` },
            opacity: 30,
            gravity: 'south',
            y: 40,
            color: '#ffffff',
          }
        ],
        secure: true,
      });
    } else if (resourceType === 'video') {
      previewUrl = cloudinary.url(publicId, {
        resource_type: 'video',
        transformation: [
          { width: 720, crop: 'limit', quality: 'auto' },
          { start_offset: '0', end_offset: '10' },
          {
            overlay: { font_family: 'Arial', font_size: 40, font_weight: 'bold', text: `PROPERTY OF ${creator.toUpperCase()}` },
            opacity: 35,
            gravity: 'south',
            y: 50,
            color: '#ffffff',
          },
        ],
        secure: true,
      });
    } else if (resourceType === 'audio') {
      previewUrl = cloudinary.url(publicId, {
        resource_type: 'video',
        transformation: [
          { start_offset: '0', end_offset: '15' }
        ],
        secure: true,
      });
    } else {
      previewUrl = null;
    }

    return NextResponse.json({
      success: true,
      previewUrl,
    });
  } catch (error) {
    console.error('❌ Cloudinary preview generation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate preview URL' },
      { status: 500 }
    );
  }
}
