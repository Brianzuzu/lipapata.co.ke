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
      const txId = searchParams.get('transaction_id') || searchParams.get('txid') || searchParams.get('TransactionID');

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
        setMessage('Confirming your payment with our server...');

        // Call our webhook to confirm and mark the transaction as completed
        const webhookUrl = `/api/webhooks/paywave?ref=${encodeURIComponent(ref)}${paymentStatus ? `&status=${encodeURIComponent(paymentStatus)}` : ''}${txId ? `&transaction_id=${encodeURIComponent(txId)}` : ''}`;
        
        const res = await fetch(webhookUrl, { method: 'GET' });

        // Give the webhook a moment to process Firestore updates
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Mark as paid in localStorage so the product page unlocks immediately
        const targetProjectId = projectId;
        if (targetProjectId) {
          localStorage.setItem(`paid_${targetProjectId}`, 'true');
        }

        setStatus('success');
        setMessage('Payment confirmed! Taking you to your download...');

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
        // Even if webhook call fails, try to redirect back to product page
        // The background polling on the product page will pick up the status
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
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
