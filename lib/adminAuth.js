export function verifyAdminRequest(request) {
  const secret = process.env.ADMIN_API_SECRET;
  // If no secret configured, allow (dev mode)
  if (!secret) return { authorized: true };
  
  const provided = request.headers.get('x-admin-secret');
  if (provided === secret) {
    return { authorized: true };
  }
  return { authorized: false, error: 'Unauthorized' };
}
