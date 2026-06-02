'use client';
export const dynamic = 'force-dynamic';

import { useEffect } from 'react';

export default function PaywaveCallbackPage() {

  // Ensure this component runs only on the client
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const searchParams = new URLSearchParams(window.location.search);
    const ref = searchParams.get('ref');
    if (window.opener && ref) {
      window.opener.postMessage({ type: 'PAYWAVE_SUCCESS', reference: ref }, '*');
      window.close();
    }
  }, []);

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
