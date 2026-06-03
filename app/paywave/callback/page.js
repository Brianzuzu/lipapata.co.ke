'use client';
export const dynamic = 'force-dynamic';
import { useEffect, useState } from 'react';

export default function PaywaveCallbackPage() {
  const [status, setStatus] = useState('processing');
  const [message, setMessage] = useState('Processing your payment...');

  // Confirm payment with backend and notify opener
  useEffect(() => {
    const confirmPayment = async () => {
      if (typeof window === 'undefined') return;
      
      const searchParams = new URLSearchParams(window.location.search);
      const ref = searchParams.get('ref');
      const paymentStatus = searchParams.get('status');
      const projectId = searchParams.get('projectId');
      const txId = searchParams.get('transaction_id') || searchParams.get('txid');

      if (!ref) {
        setStatus('error');
        setMessage('Invalid payment reference');
        return;
      }

      try {
        // Build the query string for the webhook call
        const webhookUrl = new URL('/api/webhooks/paywave', window.location.origin);
        webhookUrl.searchParams.append('ref', ref);
        if (paymentStatus) webhookUrl.searchParams.append('status', paymentStatus);
        if (txId) webhookUrl.searchParams.append('transaction_id', txId);

        // Call the webhook to confirm the payment and update the transaction in Firebase
        await fetch(webhookUrl.toString(), {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        // Give the webhook a moment to process
        await new Promise(resolve => setTimeout(resolve, 500));

        setStatus('success');
        setMessage('Payment confirmed successfully! Redirecting to download...');

        // Redirect back to the product page so auto-download triggers
        setTimeout(() => {
          if (projectId) {
            localStorage.setItem(`paid_${projectId}`, 'true');
            window.location.href = `/p/${projectId}`;
          } else {
            window.location.href = '/';
          }
        }, 2000);
      } catch (error) {
        console.error('Payment confirmation error:', error);
        setStatus('error');
        setMessage('Failed to confirm payment. You can retry by refreshing.');
      }
    };

    confirmPayment();
  }, []);

  const getStatusIcon = () => {
    switch(status) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      default:
        return '⏳';
    }
  };

  const getStatusColor = () => {
    switch(status) {
      case 'success':
        return '#10b981';
      case 'error':
        return '#ef4444';
      default:
        return '#3b82f6';
    }
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
      <div style={{
        fontSize: '3rem',
        marginBottom: '1rem',
        color: getStatusColor(),
      }}>
        {getStatusIcon()}
      </div>
      <h2 style={{ color: getStatusColor() }}>
        {status === 'success' && 'Payment Confirmed!'}
        {status === 'error' && 'Payment Confirmation Failed'}
        {status === 'processing' && 'Processing Payment...'}
      </h2>
      <p style={{ opacity: 0.7, marginBottom: '1.5rem' }}>{message}</p>
    </div>
  );
}
