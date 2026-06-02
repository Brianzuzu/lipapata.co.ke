'use client';

import { useEffect } from 'react';

export default function PaywaveCallbackPage() {

  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const ref = searchParams?.get('ref');

  useEffect(() => {
    // Notify the opener window (the preview page) that payment is completed
    if (window.opener && ref) {
      window.opener.postMessage({ type: 'PAYWAVE_SUCCESS', reference: ref }, '*');
    }
    // Close the popup after a short delay to give the parent time to handle the message
    const timeout = setTimeout(() => {
      window.close();
    }, 1500);
    return () => clearTimeout(timeout);
  }, [ref]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      background: 'var(--background)'
    }}>
      <h2>Processing payment…</h2>
      <p>You may close this window shortly.</p>
    </div>
  );
}
