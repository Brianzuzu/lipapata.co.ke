"use client";

import { useState } from 'react';
import { CldUploadWidget } from 'next-cloudinary';
import { validateUpload } from '@/lib/uploadConfig';
import { UploadCloud, CheckCircle, AlertCircle } from 'lucide-react';

export default function MediaUploader({ plan = 'FREE', onUploadSuccess }) {
  const [error, setError] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  return (
    <div className="w-full max-w-md mx-auto p-6 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl">
      <h3 className="text-xl font-bold text-white mb-2">Upload Delivery Media</h3>
      <p className="text-sm text-gray-400 mb-6">
        {plan === 'FREE' ? 'Max 20MB per file.' : 'Max 500MB per file.'}
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2 text-red-400">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      <CldUploadWidget
        uploadPreset={process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "default_preset"} // Ensure you create an unsigned preset in Cloudinary!
        options={{
          maxFiles: 1,
          resourceType: "auto", // accepts image or video
          clientAllowedFormats: ["png", "jpeg", "jpg", "mp4", "mov"],
        }}
        onUploadAdded={(file, widget) => {
          // file object from Cloudinary widget might not have traditional size, 
          // but we can catch it early if possible, or validate on success
          setIsUploading(true);
          setError('');
        }}
        onSuccess={(result, { widget }) => {
          setIsUploading(false);
          const data = result?.info;
          
          // Fallback validation if the widget allowed it through
          // Note: you can also configure Cloudinary upload presets to enforce size limits natively!
          const mockFile = { size: data.bytes }; 
          const validation = validateUpload(mockFile, plan);
          
          if (!validation.valid) {
            setError(validation.error);
            // Ideally, we'd delete the file from Cloudinary immediately here if it violated terms
            return;
          }

          // Pass the secure URL and other info back up to the parent component
          if (onUploadSuccess) {
            onUploadSuccess({
              url: data.secure_url,
              publicId: data.public_id,
              format: data.format,
              resourceType: data.resource_type,
            });
          }
        }}
        onError={(err) => {
          setIsUploading(false);
          setError(err?.statusText || 'An error occurred during upload.');
        }}
      >
        {({ open }) => {
          return (
            <button
              onClick={(e) => {
                e.preventDefault();
                open();
              }}
              disabled={isUploading}
              className="w-full flex flex-col items-center justify-center gap-3 py-10 px-4 border-2 border-dashed border-indigo-500/30 rounded-xl hover:border-indigo-500/60 bg-indigo-500/5 hover:bg-indigo-500/10 transition-all cursor-pointer group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="p-4 rounded-full bg-indigo-500/20 group-hover:bg-indigo-500/30 transition-colors">
                <UploadCloud className="w-8 h-8 text-indigo-400" />
              </div>
              <span className="text-indigo-300 font-medium">
                {isUploading ? 'Uploading...' : 'Click to browse files'}
              </span>
            </button>
          );
        }}
      </CldUploadWidget>
    </div>
  );
}
