'use client';
export const dynamic = 'force-dynamic';
import { useEffect, useState } from 'react';

export default function PaywaveCallbackPage() {
  const [status, setStatus] = useState('processing');
  const [message, setMessage] = useState('Confirming your payment...');

  useEffect(() => {
    const confirmPayment = async () => {
      if (typeof window === 'undefined') return;

      const searchParams = new URLSearchParams(window.location.search);
      const ref = searchParams.get('ref');
      // PayWave may send status as "success", "failed", "0", etc.
      const paymentStatus = searchParams.get('status') || searchParams.get('Status');
      const projectId = searchParams.get('projectId');
      const txId = searchParams.get('transaction_id') || searchParams.get('txid') || searchParams.get('TransactionID') || searchParams.get('txId');

      if (!ref) {
        // No ref — try to recover using localStorage
        const keys = Object.keys(localStorage).filter(k => k.startsWith('tx_'));
        if (keys.length > 0) {
          // Get the most recent transaction
          const latestKey = keys[keys.length - 1];
          const recoveredProjectId = latestKey.replace('tx_', '');
          window.location.href = `/p/${recoveredProjectId}`;
          return;
        }
        setStatus('error');
        setMessage('Invalid payment reference. Please contact support.');
        return;
      }

      try {
        setMessage('Confirming your payment...');

        // The webhook has already run before PayWave redirected here.
        // We trust the status + txId already embedded in this URL by the webhook redirect.
        // Just save them to localStorage so the product page can unlock the download.
        const targetProjectId = projectId;
        const isSuccess = paymentStatus === 'success' || paymentStatus === 'completed';

        if (targetProjectId && isSuccess) {
          localStorage.setItem(`paid_${targetProjectId}`, 'true');
          // txId is passed by the webhook redirect — required for /api/download verification
          if (txId) {
            localStorage.setItem(`tx_${targetProjectId}`, txId);
          }
        }

        if (isSuccess) {
          setStatus('success');
          setMessage('Payment confirmed! Taking you to your download...');
        } else if (paymentStatus === 'failed') {
          // Clean up localStorage so a retry starts fresh
          if (targetProjectId) {
            localStorage.removeItem(`tx_${targetProjectId}`);
            localStorage.removeItem(`paid_${targetProjectId}`);
          }
          setStatus('error');
          setMessage('Payment was not completed. Please go back and try again.');
          return;
        } else {
          // Unknown status — still redirect, polling on the product page will resolve it
          setStatus('success');
          setMessage('Redirecting you back...');
        }

        // Redirect back to product page
        setTimeout(() => {
          if (targetProjectId) {
            window.location.href = `/p/${targetProjectId}`;
          } else {
            window.location.href = '/';
          }
        }, 2000);

      } catch (error) {
        console.error('Payment confirmation error:', error);
        if (projectId) {
          setMessage('Redirecting you back. Your download should unlock shortly...');
          setTimeout(() => {
            window.location.href = `/p/${projectId}`;
          }, 2000);
        } else {
          setStatus('error');
          setMessage('Payment may have succeeded. Please check your email and contact support if needed.');
        }
      }
    };

    confirmPayment();
  }, []);

  const getStatusIcon = () => {
    switch (status) {
      case 'success': return '✓';
      case 'error': return '✕';
      default: return '⏳';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'success': return '#10b981';
      case 'error': return '#ef4444';
      default: return '#3b82f6';
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      background: '#fff',
      padding: '2rem',
      fontFamily: 'Inter, sans-serif',
    }}>
      <div style={{
        fontSize: '4rem',
        marginBottom: '1rem',
        color: getStatusColor(),
        width: '80px',
        height: '80px',
        borderRadius: '50%',
        background: `${getStatusColor()}20`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {getStatusIcon()}
      </div>
      <h2 style={{ color: getStatusColor(), marginBottom: '0.5rem' }}>
        {status === 'success' && 'Payment Confirmed!'}
        {status === 'error' && 'Something Went Wrong'}
        {status === 'processing' && 'Processing...'}
      </h2>
      <p style={{ opacity: 0.6, textAlign: 'center', maxWidth: '320px' }}>{message}</p>
      {status === 'processing' && (
        <div style={{
          marginTop: '1.5rem',
          width: '40px',
          height: '40px',
          border: '3px solid #e5e7eb',
          borderTop: `3px solid ${getStatusColor()}`,
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }} />
      )}
      {status === 'error' && (
        <button
          onClick={() => {
            const searchParams = new URLSearchParams(window.location.search);
            const projectId = searchParams.get('projectId');
            window.location.href = projectId ? `/p/${projectId}` : '/';
          }}
          style={{
            marginTop: '1.5rem',
            background: '#ef4444',
            color: 'white',
            border: 'none',
            padding: '0.8rem 2rem',
            borderRadius: '12px',
            fontSize: '0.95rem',
            fontWeight: '700',
            cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          ← Go Back &amp; Try Again
        </button>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
