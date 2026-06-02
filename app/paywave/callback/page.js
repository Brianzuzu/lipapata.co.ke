'use client';

import { useEffect } from 'react';

export default function PaywaveCallbackPage() {

  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const ref = searchParams?.get('ref');

  // Notify the opener window (the preview page) that payment is completed
  if (window.opener?.postMessage && ref) {
    window.opener.postMessage({ type: 'PAYWAVE_SUCCESS', reference: ref }, '*');
    // Close the popup immediately after notifying the opener
    window.close();
  }

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
