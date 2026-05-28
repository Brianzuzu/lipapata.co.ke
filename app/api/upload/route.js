import { NextResponse } from 'next/server';
import cloudinary from '../../../lib/cloudinary';
import { UPLOAD_LIMITS } from '../../../lib/uploadConfig';

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');
    const plan = formData.get('plan') || 'FREE';
    const creatorName = formData.get('creatorName') || 'Accessra Creator';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Server-side size validation
    const limits = UPLOAD_LIMITS[plan] || UPLOAD_LIMITS.FREE;
    const fileSizeMB = file.size / (1024 * 1024);

    if (fileSizeMB > limits.maxFileSizeMB) {
      return NextResponse.json(
        { error: `File too large. Max ${limits.maxFileSizeMB}MB for your plan.` },
        { status: 413 }
      );
    }

    // Convert file to buffer for Cloudinary upload
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Determine resource type
    const mimeType = file.type || '';
    const isVideo = mimeType.startsWith('video/');
    const isImage = mimeType.startsWith('image/');
    const isAudio = mimeType.startsWith('audio/');
    // Cloudinary treats audio as 'video' resource type
    const resourceType = (isVideo || isAudio) ? 'video' : isImage ? 'image' : 'raw';

    console.log('🚀 Starting Cloudinary upload for:', resourceType);
    
    // --- Upload ORIGINAL (full quality, stored temporarily) ---
    const originalUpload = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: resourceType,
          folder: 'accessra/originals',
          use_filename: true,
          unique_filename: true,
        },
        (error, result) => {
          if (error) {
            console.error('❌ Cloudinary Error:', error);
            reject(error);
          } else {
            console.log('✅ Cloudinary Upload Success');
            resolve(result);
          }
        }
      );
      uploadStream.end(buffer);
    });

    // --- Generate PREVIEW version (compressed, low-res, watermarked) ---
    let previewUrl = '';

    if (isImage) {
      // Clean preview with only the creator's name as a watermark at the bottom
      previewUrl = cloudinary.url(originalUpload.public_id, {
        transformation: [
          { width: 1200, crop: 'limit', quality: 'auto', fetch_format: 'auto' },
          {
            overlay: { font_family: 'Arial', font_size: 45, font_weight: 'bold', text: `BY ${creatorName.toUpperCase()}` },
            opacity: 30,
            gravity: 'south',
            y: 40,
            color: '#ffffff',
          }
        ],
        secure: true,
      });
    } else if (isVideo) {
      // 10 second clip with simple creator watermark
      previewUrl = cloudinary.url(originalUpload.public_id, {
        resource_type: 'video',
        transformation: [
          { width: 720, crop: 'limit', quality: 'auto' },
          { start_offset: '0', end_offset: '10' },
          {
            overlay: { font_family: 'Arial', font_size: 40, font_weight: 'bold', text: `PROPERTY OF ${creatorName.toUpperCase()}` },
            opacity: 35,
            gravity: 'south',
            y: 50,
            color: '#ffffff',
          },
        ],
        secure: true,
      });
    } else if (isAudio) {
      // 15 second clip for audio preview
      previewUrl = cloudinary.url(originalUpload.public_id, {
        resource_type: 'video',
        transformation: [
          { start_offset: '0', end_offset: '15' }
        ],
        secure: true,
      });
    } else {
      // For PDFs and other raw files, no preview — just show metadata
      previewUrl = null;
    }

    return NextResponse.json({
      success: true,
      original: {
        url: originalUpload.secure_url,
        publicId: originalUpload.public_id,
        format: originalUpload.format,
        resourceType: isAudio ? 'audio' : originalUpload.resource_type,
        bytes: originalUpload.bytes,
      },
      preview: {
        url: previewUrl,
      },
    });
  } catch (error) {
    console.error('Upload API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Upload failed' },
      { status: 500 }
    );
  }
}

// End of Route Handler
