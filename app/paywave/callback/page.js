'use client';
export const dynamic = 'force-dynamic';
import { useEffect } from 'react';

export default function PaywaveCallbackPage() {
  // Notify opener and attempt to close the popup
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const searchParams = new URLSearchParams(window.location.search);
    const ref = searchParams.get('ref');
    if (window.opener && ref) {
      window.opener.postMessage({ type: 'PAYWAVE_SUCCESS', reference: ref }, location.origin);
      window.close();
      // Close after a short delay – works for windows opened via script
      setTimeout(() => {
        window.close();
      }, 300);
    }
  }, []);

  const handleManualClose = () => {
    window.close();
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      background: 'var(--background)',
      padding: '2rem',
    }}>
      <h2>Payment processed successfully!</h2>
      <p>You may close this window.</p>
      <button onClick={handleManualClose} style={{
        marginTop: '1rem',
        padding: '0.8rem 1.5rem',
        background: '#3b82f6',
        color: '#fff',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
      }}>Close</button>
    </div>
  );
}
