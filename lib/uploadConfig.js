export const UPLOAD_LIMITS = {
  FREE: {
    maxFileSizeMB: 500,
    maxUploads: Infinity,
    maxPortfolioItems: Infinity,
  },
  PAID: {
    maxFileSizeMB: 2000,
    maxUploads: Infinity,
    maxPortfolioItems: Infinity,
  }
};

// Whitelisted MIME type prefixes / exact types
const ALLOWED_MIME_PREFIXES = [
  'image/',
  'video/',
  'audio/',
];

const ALLOWED_MIME_EXACT = new Set([
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',
  'application/x-zip',
  'application/octet-stream', // generic binary — many design files use this
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/epub+zip',
  'text/plain',
  'text/csv',
  'application/x-rar-compressed',
  'application/vnd.rar',
]);

// Blocked dangerous extensions — regardless of MIME type
const BLOCKED_EXTENSIONS = new Set([
  'exe', 'bat', 'cmd', 'sh', 'ps1', 'vbs', 'js', 'msi',
  'dll', 'com', 'scr', 'hta', 'jar', 'py', 'rb', 'php',
  'pl', 'cgi', 'app', 'deb', 'rpm', 'apk', 'ipa',
]);

// Allowed file extensions as a safety net for design files
const ALLOWED_EXTENSIONS = new Set([
  // Images
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico', 'bmp', 'tiff', 'avif', 'heic',
  // Video
  'mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'm4v', 'wmv',
  // Audio
  'mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'aiff', 'wma',
  // Docs
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'epub', 'txt', 'csv', 'rtf',
  // Design
  'psd', 'ai', 'fig', 'sketch', 'xd', 'indd', 'eps', 'afdesign', 'afphoto',
  // Fonts
  'ttf', 'otf', 'woff', 'woff2',
  // Archives
  'zip', 'rar', '7z', 'tar', 'gz',
]);

export const validateUpload = (file, plan = 'FREE') => {
  const limits = UPLOAD_LIMITS[plan] || UPLOAD_LIMITS.FREE;

  // 1. Check file size
  const fileSizeMB = file.size / (1024 * 1024);
  if (fileSizeMB > limits.maxFileSizeMB) {
    return {
      valid: false,
      error: `File too large (${fileSizeMB.toFixed(0)} MB). Maximum allowed is ${limits.maxFileSizeMB} MB.`,
    };
  }

  // 2. Extract extension
  const ext = (file.name?.split('.').pop() || '').toLowerCase().trim();

  // 3. Block dangerous extensions first
  if (BLOCKED_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      error: `File type ".${ext}" is not allowed for security reasons.`,
    };
  }

  // 4. Check against whitelist
  const mimeType = (file.type || '').toLowerCase();
  const mimeAllowed =
    ALLOWED_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix)) ||
    ALLOWED_MIME_EXACT.has(mimeType) ||
    mimeType === ''; // some design files report no MIME type

  const extAllowed = ALLOWED_EXTENSIONS.has(ext) || ext === '';

  if (!mimeAllowed && !extAllowed) {
    return {
      valid: false,
      error: `"${file.name}" is not a supported file type. Upload images, videos, audio, PDFs, ZIPs, or design files.`,
    };
  }

  return { valid: true };
};
