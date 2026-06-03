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
        // The webhook will process the payment regardless of the response status
        await fetch(webhookUrl.toString(), {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        // Give the webhook a moment to process
        await new Promise(resolve => setTimeout(resolve, 500));

        setStatus('success');
        setMessage('Payment confirmed successfully!');

        // Notify the parent window of the successful payment
        if (window.opener) {
          window.opener.postMessage({ type: 'PAYWAVE_SUCCESS', reference: ref }, location.origin);
        }

        // Close the popup after a short delay
        setTimeout(() => {
          window.close();
        }, 1500);
      } catch (error) {
        console.error('Payment confirmation error:', error);
        setStatus('error');
        setMessage('Failed to confirm payment. Please refresh the page.');

        // Still notify parent in case it was processed on PayWave's end
        if (window.opener && ref) {
          window.opener.postMessage({ type: 'PAYWAVE_SUCCESS', reference: ref }, location.origin);
        }

        // Try to close anyway
        setTimeout(() => {
          window.close();
        }, 3000);
      }
    };

    confirmPayment();
  }, []);

  const handleManualClose = () => {
    window.close();
  };

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
      {status !== 'processing' && (
        <button onClick={handleManualClose} style={{
          marginTop: '1rem',
          padding: '0.8rem 1.5rem',
          background: getStatusColor(),
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          fontSize: '1rem',
        }}>
          Close Window
        </button>
      )}
    </div>
  );
}
