export const UPLOAD_LIMITS = {
  FREE: {
    maxFileSizeMB: Infinity,
    maxUploads: Infinity,
    maxPortfolioItems: Infinity,
  },
  PAID: {
    maxFileSizeMB: Infinity,
    maxUploads: Infinity,
    maxPortfolioItems: Infinity,
  }
};

export const validateUpload = (file, plan = 'FREE') => {
  return { valid: true };
};
