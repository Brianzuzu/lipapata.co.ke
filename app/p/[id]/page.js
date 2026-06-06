'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Lock, CheckCircle, Shield, Globe, ExternalLink, ArrowRight, Loader2, Info, Music, FileText, Archive, X } from 'lucide-react';
import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { calculateCommission } from '../../../lib/commission';
import { getGlobalSettings } from '../../../lib/settings';
import Link from 'next/link';

const Toast = ({ message, type, onClose }) => (
  <motion.div 
    initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
    className={`toast ${type}`}
    style={{ position: 'fixed', bottom: '2rem', right: '2rem', padding: '1rem 1.5rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem', zIndex: 1000, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
  >
    {message}
    <button onClick={onClose}><X size={16} /></button>
  </motion.div>
);

export default function ProjectPreview({ params }) {
  const [isPaid, setIsPaid] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [paymentBreakdown, setPaymentBreakdown] = useState(null);
  const [otherProjects, setOtherProjects] = useState([]);
  const [previewTimeLeft, setPreviewTimeLeft] = useState(10);
  const [isBlurred, setIsBlurred] = useState(false);
  const [previewStarted, setPreviewStarted] = useState(false);
  const [globalSettings, setGlobalSettings] = useState(null);
  const [email, setEmail] = useState('');
  const router = useRouter();
  const [customPrice, setCustomPrice] = useState('');
  const [discountCode, setDiscountCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState(null);
  const [discountError, setDiscountError] = useState('');
  const [isApplyingDiscount, setIsApplyingDiscount] = useState(false);
  const [toast, setToast] = useState(null);
  const [pendingPaymentRef, setPendingPaymentRef] = useState(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [paymentFailed, setPaymentFailed] = useState(false);
  const [paymentFailedMsg, setPaymentFailedMsg] = useState('');
  const [stkSecondsLeft, setStkSecondsLeft] = useState(null);
  const [isManualVerifyOpen, setIsManualVerifyOpen] = useState(false);
  const [manualMpesaMessage, setManualMpesaMessage] = useState('');
  const [isManualVerifying, setIsManualVerifying] = useState(false);

  useEffect(() => {
    // Auto-fill phone number from localStorage if available
    const storedPhone = typeof window !== 'undefined' ? localStorage.getItem('user_phone') : '';
if (storedPhone) setPhoneNumber(storedPhone);
const storedEmail = typeof window !== 'undefined' ? localStorage.getItem('user_email') : '';
if (storedEmail) setEmail(storedEmail);
    const fetchProject = async () => {
      const timeout = setTimeout(() => {
        if (loading) {
          setLoading(false);
          setError("This link is taking too long to load. Please refresh.");
        }
      }, 8000);

      try {
        if (params.id.startsWith('temp_')) {
          const guestProjects = JSON.parse(localStorage.getItem('guest_projects') || '[]');
          const found = guestProjects.find(p => p.id === params.id);
          if (found) {
            setProject(found);
          } else {
            setError("Project not found. It might have expired or been deleted.");
          }
        } else {
          const response = await fetch(`/api/projects/${params.id}`);
          if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || 'Project not found');
          }
          const data = await response.json();
          setProject(data);
if (typeof window !== 'undefined') {
  const paidFlag = localStorage.getItem(`paid_${data.id}`);
  if (paidFlag === 'true') setIsPaid(true);
}
        }
      } catch (err) {
        console.error("Error fetching project:", err);
        setError("Failed to load project details.");
      } finally {
        clearTimeout(timeout);
        setLoading(false);
      }
    };

    fetchProject();
    getGlobalSettings().then(setGlobalSettings);
  }, [params.id]);

  useEffect(() => {
    let timer;
    if (previewStarted && !isPaid && previewTimeLeft > 0) {
      timer = setInterval(() => {
        setPreviewTimeLeft((prev) => {
          if (prev <= 1) {
            setIsBlurred(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [previewStarted, isPaid, previewTimeLeft]);

  useEffect(() => {
    if (isPaid) {
      setIsBlurred(false);
      setPreviewTimeLeft(10);
    }
  }, [isPaid]);

  // Poll for payment status in case user completes payment but isn't redirected
  // or if they press the back button.
  // MOBILE FIX: also listen for visibilitychange — mobile browsers suspend setInterval
  // when the tab is backgrounded (e.g. the user switches to M-Pesa to enter PIN).
  // When they come back, we fire a check immediately.
  useEffect(() => {
    let intervalId;

    if (project && !isPaid && typeof window !== 'undefined') {
      const txId = localStorage.getItem(`tx_${project.id}`);
      if (txId) {
        const checkStatus = async () => {
          try {
            const res = await fetch(`/api/pay/status?transactionId=${txId}`);
            if (res.ok) {
              const data = await res.json();
              if (data.status === 'completed' || data.status === 'success') {
                setIsPaid(true);
                localStorage.setItem(`paid_${project.id}`, 'true');
                setToast({ message: 'Payment confirmed! Unlocking your files...', type: 'success' });
                setIsPaying(false);
                setPendingPaymentRef(null);
                setStkSecondsLeft(null);
                clearInterval(intervalId);
              } else if (data.status === 'failed') {
                // Payment was declined or cancelled — clean up and let user retry
                clearInterval(intervalId);
                localStorage.removeItem(`tx_${project.id}`);
                setIsPaying(false);
                setPendingPaymentRef(null);
                setStkSecondsLeft(null);
                setPaymentFailed(true);
                setPaymentFailedMsg('Your M-Pesa payment was not completed. You can try again below.');
                setToast({ message: 'Payment was not completed. Please try again.', type: 'error' });
              }
            }
          } catch (e) {
            console.error('Status check error:', e);
          }
        };

        // Immediate check + polling interval
        checkStatus();
        intervalId = setInterval(checkStatus, 4000);

        // MOBILE: fire an immediate check the moment the user returns to the tab
        const onVisibilityChange = () => {
          if (document.visibilityState === 'visible') {
            checkStatus();
          }
        };
        document.addEventListener('visibilitychange', onVisibilityChange);

        return () => {
          clearInterval(intervalId);
          document.removeEventListener('visibilitychange', onVisibilityChange);
        };
      }
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  // pendingPaymentRef is included so polling starts the moment the STK push response arrives
  }, [project, isPaid, pendingPaymentRef]);

  // STK countdown timer — auto-expire after 2 minutes if no payment received.
  // IMPORTANT: on expiry, do one final status check before declaring it failed
  // in case the user paid in the last few seconds and the Paywave webhook was slow.
  useEffect(() => {
    if (!pendingPaymentRef) {
      setStkSecondsLeft(null);
      return;
    }
    setStkSecondsLeft(120); // 2 minutes (matches Safaricom STK push window)
    const tick = setInterval(() => {
      setStkSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(tick);
          // Do one final check before showing timeout — the user may have paid
          // in the last second while the countdown was frozen (mobile backgrounding)
          if (project) {
            const txId = typeof window !== 'undefined' ? localStorage.getItem(`tx_${project.id}`) : null;
            if (txId) {
              fetch(`/api/pay/status?transactionId=${txId}`)
                .then(r => r.json())
                .then(data => {
                  if (data.status === 'completed' || data.status === 'success') {
                    setIsPaid(true);
                    localStorage.setItem(`paid_${project.id}`, 'true');
                    setToast({ message: 'Payment confirmed! Unlocking your files...', type: 'success' });
                    setIsPaying(false);
                    setPendingPaymentRef(null);
                    setStkSecondsLeft(null);
                  } else {
                    // Genuinely timed out
                    setIsPaying(false);
                    setPendingPaymentRef(null);
                    setStkSecondsLeft(null);
                    setPaymentFailed(true);
                    setPaymentFailedMsg('The M-Pesa prompt expired — it may not have reached your phone, or you missed it. Please try again.');
                  }
                })
                .catch(() => {
                  setIsPaying(false);
                  setPendingPaymentRef(null);
                  setStkSecondsLeft(null);
                  setPaymentFailed(true);
                  setPaymentFailedMsg('The M-Pesa prompt expired. Please try again.');
                });
            } else {
              setIsPaying(false);
              setPendingPaymentRef(null);
              setStkSecondsLeft(null);
              setPaymentFailed(true);
              setPaymentFailedMsg('The M-Pesa prompt expired. Please try again.');
            }
          }
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [pendingPaymentRef, project]);

  useEffect(() => {
    if (project?.price !== undefined) {
      const rate = globalSettings?.globalCommission;
      let amountToUse = project.isPWYW && customPrice && parseFloat(customPrice) >= parseFloat(project.price)
                          ? parseFloat(customPrice) 
                          : parseFloat(project.price);
                          
      if (appliedDiscount) {
        if (appliedDiscount.type === 'percentage') {
          amountToUse = amountToUse - (amountToUse * (appliedDiscount.value / 100));
        } else if (appliedDiscount.type === 'fixed') {
          amountToUse = Math.max(0, amountToUse - appliedDiscount.value);
        }
      }
                          
      const breakdown = calculateCommission(
        amountToUse, 
        project.creatorPlan || 'FREE',
        rate
      );
      setPaymentBreakdown(breakdown);
    }
  }, [project, globalSettings, customPrice, appliedDiscount]);




  useEffect(() => {
    if (project?.uid) {
      const fetchOtherWork = async () => {
        try {
          const q = query(
            collection(db, "projects"),
            where("uid", "==", project.uid),
            limit(4)
          );
          const querySnapshot = await getDocs(q);
          const docs = querySnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(d => d.id !== params.id);
          setOtherProjects(docs);
        } catch (err) {
          console.error("Error fetching other work:", err);
        }
      };
      fetchOtherWork();
    }
  }, [project, params.id]);

  // Called when user clicks "I've Paid" — queries the status route securely with forceCheck=true
  const handleConfirmPayment = async () => {
    if (!project || isConfirming) return;
    const txId = typeof window !== 'undefined' ? localStorage.getItem(`tx_${project.id}`) : null;
    if (!txId) {
      setToast({ message: 'No pending transaction found. Please try again.', type: 'error' });
      return;
    }
    
    setIsConfirming(true);
    try {
      const res = await fetch(`/api/pay/status?transactionId=${txId}&forceCheck=true`);
      if (res.ok) {
        const data = await res.json();
        console.log("PAYWAVE RAW RESPONSE (forceCheck):", data);
        
        if (data.status === 'completed' || data.status === 'success') {

          setIsPaid(true);
          setIsPaying(false);
          setPendingPaymentRef(null);
          if (typeof window !== 'undefined') {
            localStorage.setItem(`paid_${project.id}`, 'true');
          }
          setToast({ message: 'Payment confirmed! Unlocking your files...', type: 'success' });
        } else {
          setToast({ message: 'Safaricom is still processing your payment. This can take up to 60 seconds. Please wait a moment and try again.', type: 'warning' });
        }
      } else {
        setToast({ message: 'Could not confirm payment. Please try again.', type: 'error' });
      }
    } catch (err) {
      console.error('Confirm payment error:', err);
      setToast({ message: 'Error confirming payment. Please refresh.', type: 'error' });
    } finally {
      setIsConfirming(false);
    }
  };

  const handleManualVerify = async () => {
    if (!manualMpesaMessage.trim()) {
      setToast({ message: 'Please paste the M-Pesa message first.', type: 'warning' });
      return;
    }
    const txId = typeof window !== 'undefined' ? localStorage.getItem(`tx_${project.id}`) : null;
    if (!txId) {
      setToast({ message: 'No transaction found. Please refresh and try paying again.', type: 'error' });
      return;
    }

    setIsManualVerifying(true);
    try {
      const res = await fetch('/api/pay/manual-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId: txId, mpesaMessage: manualMpesaMessage })
      });
      const data = await res.json();
      
      if (res.ok && data.success) {
        setIsPaid(true);
        setIsPaying(false);
        setPendingPaymentRef(null);
        if (typeof window !== 'undefined') {
          localStorage.setItem(`paid_${project.id}`, 'true');
        }
        setToast({ message: 'Receipt verified! Unlocking your files...', type: 'success' });
      } else {
        setToast({ message: data.error || 'Could not verify receipt. Make sure you pasted the exact M-Pesa message.', type: 'error' });
      }
    } catch (err) {
      console.error(err);
      setToast({ message: 'An error occurred. Please try again.', type: 'error' });
    } finally {
      setIsManualVerifying(false);
    }
  };

  const handlePayment = async () => {
    if (!phoneNumber) return;
    setIsPaying(true);
    setPaymentFailed(false);
    setPaymentFailedMsg('');
    setError(null);

    // Clear any stale transaction from a previous attempt so the poller
    // doesn't immediately pick it up and show a false "payment not completed" modal.
    if (typeof window !== 'undefined' && project?.id) {
      localStorage.removeItem(`tx_${project.id}`);
    }

    try {
      const response = await fetch('/api/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          amount: paymentBreakdown?.total,
          phoneNumber: phoneNumber.replace(/^0/, '254').replace(/^\+/, '').replace(/^7/, '2547'),
          email: email,
          discountCode: appliedDiscount ? discountCode : undefined
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Payment failed');
      }

      // Save transaction ID for polling
      if (typeof window !== 'undefined') {
        localStorage.setItem('user_phone', phoneNumber);
        localStorage.setItem('user_email', email);
        if (data.transactionId) {
          localStorage.setItem(`tx_${project?.id}`, data.transactionId);
        }
      }

      // STK Push sent — stay on page, polling useEffect will detect completion
      setPendingPaymentRef(data.reference || null);
      setToast({ message: '📱 M-Pesa prompt sent! Check your phone and enter your PIN.', type: 'success' });

    } catch (err) {
      console.error('Payment error:', err);
      setError(err.message);
      setToast({ message: err.message, type: 'error' });
      setIsPaying(false);
    }
  };

  const applyDiscount = async () => {
    if (!discountCode) return;
    setIsApplyingDiscount(true);
    setDiscountError('');
    try {
      const res = await fetch('/api/discount/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id, code: discountCode })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Invalid discount code');
      }
      setAppliedDiscount(data.discount);
      setDiscountError('');
    } catch (err) {
      setDiscountError(err.message);
      setAppliedDiscount(null);
    } finally {
      setIsApplyingDiscount(false);
    }
  };

  if (loading) {
    return (
      <div className="preview-loading">
        <Loader2 className="spin" size={40} />
        <p>Loading secure preview...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="preview-error">
        <h1>Oops!</h1>
        <p>{error}</p>
        <Link href="/" className="btn-secondary">Go Home</Link>
      </div>
    );
  }

  if (!project) return null;

  return (
    <div className="preview-container">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <nav className="preview-nav">
        <Link href="/" className="logo-container" style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', textDecoration: 'none' }}>
          <img src="/logo-v2.png" alt="Lipapata Logo" style={{ width: '80px', height: '80px', objectFit: 'contain', mixBlendMode: 'darken' }} />
          <div className="logo" style={{ color: 'black', fontWeight: '800' }}>Lipapata<span>.</span></div>
        </Link>
        <div className="nav-badges">
          <span className="badge badge-secure"><Shield size={14} /> Secure Delivery</span>
          <span className="badge badge-verified"><CheckCircle size={14} /> Verified Work</span>
        </div>
      </nav>

      <main className="preview-content">
        <div className="preview-grid">
          <div className="preview-visual glass-card">
            <div 
              className={`visual-wrapper ${isBlurred && !isPaid ? 'media-blurred' : ''}`}
              onMouseEnter={() => !previewStarted && setPreviewStarted(true)}
              onClick={() => !previewStarted && setPreviewStarted(true)}
              style={project.files && project.files.length > 1 ? { display: 'flex', overflowX: 'auto', gap: '1rem', padding: '1rem', alignItems: 'center', justifyContent: 'flex-start', scrollSnapType: 'x mandatory' } : {}}
            >
              {project.files && project.files.length > 0 ? (
                project.files.map((file, idx) => (
                  <div key={idx} style={{ flex: '0 0 auto', width: project.files.length > 1 ? '85%' : '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', scrollSnapAlign: 'center', position: 'relative' }}>
                    {file.resourceType === 'video' ? (
                      <video src={file.previewUrl} controls={!isBlurred || isPaid} className="preview-media" />
                    ) : file.resourceType === 'audio' ? (
                      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', width: '100%'}}>
                        <div style={{padding: '2rem', background: 'rgba(0,0,0,0.05)', borderRadius: '50%'}}>
                          <Music size={48} opacity={0.5} />
                        </div>
                        {file.previewUrl && <audio src={file.previewUrl} controls={!isBlurred || isPaid} style={{width: '80%'}} />}
                      </div>
                    ) : file.previewUrl ? (
                      <img src={file.previewUrl} alt={`Preview ${idx + 1}`} className="preview-media" />
                    ) : (
                      <div className="media-placeholder" style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', background: 'rgba(0,0,0,0.02)', borderRadius: '12px'}}>
                        {file.fileName?.endsWith('.zip') ? <Archive size={60} opacity={0.2} /> : <FileText size={60} opacity={0.2} />}
                        <p style={{opacity: 0.5, marginTop: '1rem'}}>{file.fileName || 'No visual preview'}</p>
                      </div>
                    )}
                    {project.files.length > 1 && (
                      <div style={{position: 'absolute', top: '1rem', left: '1rem', background: 'rgba(0,0,0,0.5)', color: 'white', padding: '0.2rem 0.6rem', borderRadius: '10px', fontSize: '0.8rem', zIndex: 5}}>
                        {idx + 1} / {project.files.length}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                project.resourceType === 'video' ? (
                  <video src={project.previewUrl} controls={!isBlurred || isPaid} className="preview-media" />
                ) : project.resourceType === 'audio' ? (
                  <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', width: '100%'}}>
                    <div style={{padding: '2rem', background: 'rgba(0,0,0,0.05)', borderRadius: '50%'}}>
                      <Music size={48} opacity={0.5} />
                    </div>
                    {project.previewUrl && <audio src={project.previewUrl} controls={!isBlurred || isPaid} style={{width: '80%'}} />}
                  </div>
                ) : project.previewUrl ? (
                  <img src={project.previewUrl} alt="Preview" className="preview-media" />
                ) : (
                  <div className="media-placeholder">
                    {project.fileName?.endsWith('.zip') ? <Archive size={60} opacity={0.2} /> : <FileText size={60} opacity={0.2} />}
                    <p>{project.fileName || 'No visual preview available'}</p>
                  </div>
                )
              )}
              {!isPaid && (
                <div className={`preview-overlay ${isBlurred ? 'blurred-overlay' : ''}`}>
                  {isBlurred ? (
                    <>
                      <Lock size={40} className="lock-icon" />
                      <h3 style={{ margin: '1rem 0 0.5rem' }}>Preview Time Expired</h3>
                      <p style={{ opacity: 0.7, fontSize: '0.9rem' }}>Pay to unlock full access and download</p>
                    </>
                  ) : (
                    <>
                      {!previewStarted ? (
                        <div className="start-preview-btn">
                          <span>Click to Preview (10s)</span>
                        </div>
                      ) : (
                        <div className="timer-badge">
                          {previewTimeLeft}s remaining
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="preview-info glass-card">
            <div className="info-header">
              <span className="category-tag">Digital Asset</span>
              <h1>{project.title}</h1>
              <div className="file-meta">
                <span>{project.resourceType?.toUpperCase() || 'FILE'}</span>
                <span>•</span>
                <span>{(project.fileSize / (1024 * 1024)).toFixed(2)} MB</span>
                {project.files && project.files.length > 1 && (
                  <>
                    <span>•</span>
                    <span style={{color: 'var(--primary)', fontWeight: 'bold'}}>{project.files.length} Files included</span>
                  </>
                )}
              </div>
            </div>

            <div className="payment-section">
              {isPaid ? (
                <div className="paid-success">
                  <CheckCircle size={60} className="icon-success" />
                  <h2>Payment Confirmed!</h2>
                  {(() => {
                    const filesToDownload = project.files && project.files.length > 0 
                      ? project.files 
                      : [{ fileName: project.fileName, originalUrl: project.originalUrl }];
                    
                    const handleDownload = async (e, index, safeName) => {
                      e.preventDefault();
                      
                      const txId = (typeof window !== 'undefined' ? localStorage.getItem(`tx_${project.id}`) : null) || project.lastTransactionId;
                      
                      if (!txId) {
                        alert("Transaction not found. Please refresh and try again.");
                        return;
                      }

                      try {
                        const downloadUrl = `/api/download/${project.id}?t=${txId}${project.files && project.files.length > 0 ? `&index=${index}` : ''}`;
                        const response = await fetch(downloadUrl);
                        if (!response.ok) {
                          const errData = await response.json();
                          throw new Error(errData.error || 'Download failed');
                        }
                        
                        const blob = await response.blob();
                        const blobUrl = window.URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = blobUrl;
                        link.setAttribute('download', safeName);
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        setTimeout(() => window.URL.revokeObjectURL(blobUrl), 100);
                      } catch (err) {
                        console.error('Download error:', err);
                        alert(err.message || "Failed to download file. Please contact support.");
                      }
                    };

                      return (
                        <>
                          <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
                            {filesToDownload.map((f, idx) => {
                              const safeName = (f.fileName || project.title || `file_${idx}`).replace(/[^a-z0-9.]/gi, '_');
                              return (
                                <button 
                                  key={idx}
                                  onClick={(e) => handleDownload(e, idx, safeName)}
                                  className="btn-primary"
                                  style={{ 
                                    width: '100%',
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center',
                                    gap: '10px',
                                    color: 'white',
                                    background: '#3b82f6',
                                    border: 'none',
                                    padding: '1rem',
                                    borderRadius: '12px',
                                    cursor: 'pointer',
                                    fontWeight: 'bold',
                                    boxShadow: '0 4px 15px rgba(59, 130, 246, 0.3)'
                                  }}
                                >
                                  <Download size={20} /> Download {filesToDownload.length > 1 ? f.fileName || `File ${idx+1}` : 'Original File'}
                                </button>
                              );
                            })}
                          </div>
                          <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px dashed var(--card-border)' }}>
                            <Link href={`/portfolio/${project.uid}`} className="btn-text" style={{ fontWeight: '700' }}>
                              View more from this creator <ArrowRight size={16} style={{ marginLeft: '0.5rem' }} />
                            </Link>
                          </div>
                        </>
                      );
                  })()}
                </div>
              ) : (
                <>
                  {project.isPWYW ? (
                    <div className="price-card">
                      <span className="price-label">Name your price (Min KSh {parseFloat(project.price || 0).toLocaleString()})</span>
                      <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem'}}>
                        <span style={{fontSize: '1.5rem', fontWeight: 'bold'}}>KSh</span>
                        <input 
                          type="number" 
                          min={project.price} 
                          value={customPrice} 
                          placeholder={project.price}
                          onChange={(e) => setCustomPrice(e.target.value)} 
                          style={{fontSize: '1.5rem', fontWeight: 'bold', padding: '0.5rem', width: '100%', borderRadius: '8px', border: '1px solid var(--card-border)', background: 'transparent'}} 
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="price-card">
                      <span className="price-label">Price to Unlock</span>
                      <span className="price-amount">KSh {paymentBreakdown?.total?.toLocaleString()}</span>
                    </div>
                  )}

                  <div className="input-group" style={{marginTop: '1.5rem'}}>
                    <label>Discount Code (Optional)</label>
                    <div style={{display: 'flex', gap: '0.5rem'}}>
                      <input 
                        type="text" 
                        placeholder="Got a code?" 
                        value={discountCode}
                        onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                      />
                      <button 
                        className="btn-secondary" 
                        onClick={applyDiscount} 
                        disabled={!discountCode || isApplyingDiscount}
                      >
                        {isApplyingDiscount ? '...' : 'Apply'}
                      </button>
                    </div>
                    {discountError && <p style={{color: '#f87171', fontSize: '0.8rem', marginTop: '0.5rem'}}>{discountError}</p>}
                    {appliedDiscount && <p style={{color: '#27F5BB', fontSize: '0.8rem', marginTop: '0.5rem'}}>Discount applied successfully!</p>}
                  </div>

                  <div className="input-group" style={{marginTop: '1.5rem'}}>
                    <label>Your Email (for receipt)</label>
                    <input 
                      type="email" 
                      placeholder="name@example.com" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      style={{ marginBottom: '1rem' }}
                    />
                  </div>

                  <div className="input-group">
                    <label>Your M-Pesa Number</label>
                    <input 
                      type="text" 
                      placeholder="07XX XXX XXX" 
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                    />
                  </div>

                  <button 
                    className="btn-primary btn-unlock"
                    disabled={isPaying || !phoneNumber || !email}
                    onClick={handlePayment}
                  >
                    {isPaying && !pendingPaymentRef ? <Loader2 className="spin" size={20} /> : `Pay & Unlock (KSh ${paymentBreakdown?.total?.toLocaleString()})`}
                  </button>

                  {/* Payment failed banner */}
                  {paymentFailed && !isPaying && (
                    <div style={{
                      marginTop: '1.5rem',
                      padding: '1.25rem 1.5rem',
                      background: 'linear-gradient(135deg, #fff1f2, #ffe4e6)',
                      borderRadius: '16px',
                      border: '2px solid #fca5a5',
                      textAlign: 'center',
                    }}>
                      <div style={{ fontSize: '2rem', marginBottom: '0.4rem' }}>❌</div>
                      <h3 style={{ margin: '0 0 0.4rem', color: '#991b1b', fontSize: '1rem' }}>Payment Not Completed</h3>
                      <p style={{ margin: '0 0 1rem', color: '#b91c1c', fontSize: '0.85rem', lineHeight: 1.5 }}>
                        {paymentFailedMsg}
                      </p>
                      <button
                        onClick={() => { setPaymentFailed(false); setPaymentFailedMsg(''); }}
                        style={{
                          background: '#ef4444',
                          color: 'white',
                          border: 'none',
                          padding: '0.7rem 1.5rem',
                          borderRadius: '10px',
                          fontSize: '0.9rem',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          width: '100%',
                          fontFamily: 'inherit',
                        }}
                      >
                        Try Again
                      </button>
                      {/* Support note — shown only on timeout, not on clean cancel/fail */}
                      {paymentFailedMsg?.includes('expired') && (
                        <p style={{ margin: '1rem 0 0', color: '#9f1239', fontSize: '0.75rem', lineHeight: 1.5 }}>
                          💸 If M-Pesa deducted money but you can't download,{' '}
                          <a
                            href={`https://wa.me/254${(typeof window !== 'undefined' ? localStorage.getItem('user_phone') || '' : '').replace(/^(0|254|\+254)/, '')}`}
                            style={{ color: '#be123c', fontWeight: 'bold' }}
                            onClick={(e) => {
                              e.preventDefault();
                              window.open(`https://wa.me/254759221095?text=Hi%2C%20I%20paid%20on%20Lipapata%20but%20couldn%27t%20download.%20My%20email%3A%20${encodeURIComponent(typeof window !== 'undefined' ? localStorage.getItem('user_email') || '' : '')}`, '_blank');
                            }}
                          >
                            contact support
                          </a>{' '}
                          with your M-Pesa transaction code and we'll sort it out immediately.
                        </p>
                      )}
                    </div>
                  )}


                  {/* STK Push waiting screen — shown after M-Pesa prompt is sent */}
                  {isPaying && pendingPaymentRef && (
                    <div style={{
                      marginTop: '1.5rem',
                      padding: '1.5rem',
                      background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)',
                      borderRadius: '16px',
                      border: '2px solid #86efac',
                      textAlign: 'center',
                    }}>
                      <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📱</div>
                      <h3 style={{ margin: '0 0 0.5rem', color: '#166534', fontSize: '1.1rem' }}>
                        Check Your Phone!
                      </h3>
                      <p style={{ margin: '0 0 0.75rem', color: '#15803d', fontSize: '0.9rem' }}>
                        An M-Pesa prompt has been sent to <strong>{phoneNumber}</strong>. Enter your PIN to complete payment.
                      </p>

                      {/* Countdown timer */}
                      {stkSecondsLeft !== null && (
                        <div style={{ marginBottom: '0.75rem' }}>
                          <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            background: stkSecondsLeft <= 30 ? '#fef2f2' : '#f0fdf4',
                            color: stkSecondsLeft <= 30 ? '#dc2626' : '#16a34a',
                            border: `1px solid ${stkSecondsLeft <= 30 ? '#fca5a5' : '#86efac'}`,
                            padding: '0.3rem 0.8rem',
                            borderRadius: '100px',
                            fontSize: '0.8rem',
                            fontWeight: '700',
                          }}>
                            ⏱ Expires in {Math.floor(stkSecondsLeft / 60)}:{String(stkSecondsLeft % 60).padStart(2, '0')}
                          </div>
                        </div>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: '#16a34a', fontSize: '0.85rem', marginBottom: '1rem' }}>
                        <Loader2 className="spin" size={16} />
                        <span>Verifying payment automatically...</span>
                      </div>
                      
                      {/* Only show manual button if it's been more than 30 seconds */}
                      {stkSecondsLeft !== null && stkSecondsLeft <= 90 && (
                        <button
                          onClick={handleConfirmPayment}
                          disabled={isConfirming}
                          style={{
                            background: '#16a34a',
                            color: 'white',
                            border: 'none',
                            padding: '0.75rem 1.5rem',
                            borderRadius: '10px',
                            fontSize: '0.9rem',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            boxShadow: '0 4px 10px rgba(22, 163, 74, 0.25)',
                            fontFamily: 'inherit',
                          }}
                        >
                          {isConfirming ? (
                            <>
                              <Loader2 className="spin" size={16} />
                              <span>Checking...</span>
                            </>
                          ) : (
                            "Check Status Manually"
                          )}
                        </button>
                      )}
                      {/* Manual Verify Fallback - Shown only if timer expires or is open */}
                      {(isManualVerifyOpen || (stkSecondsLeft === 0)) && (
                        <div style={{ marginTop: '1.5rem', background: '#ffffff', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e5e7eb', textAlign: 'left' }}>
                          <h4 style={{ margin: '0 0 0.5rem', color: '#374151', fontSize: '0.95rem' }}>M-Pesa taking too long?</h4>
                          <p style={{ margin: '0 0 1rem', color: '#6b7280', fontSize: '0.85rem' }}>
                            If you already received the M-Pesa confirmation SMS, paste the entire message below to verify your payment instantly.
                          </p>
                          <textarea
                            value={manualMpesaMessage}
                            onChange={(e) => setManualMpesaMessage(e.target.value)}
                            placeholder="Paste the full M-Pesa message here (e.g. UF61B6KZGY Confirmed. Ksh2.00 paid to...)"
                            style={{
                              width: '100%',
                              minHeight: '80px',
                              padding: '0.75rem',
                              borderRadius: '8px',
                              border: '1px solid #d1d5db',
                              fontSize: '0.85rem',
                              marginBottom: '0.75rem',
                              fontFamily: 'inherit',
                              resize: 'vertical'
                            }}
                          />
                          <button
                            onClick={handleManualVerify}
                            disabled={isManualVerifying || !manualMpesaMessage.trim()}
                            style={{
                              background: '#2563eb',
                              color: 'white',
                              border: 'none',
                              padding: '0.75rem 1.5rem',
                              borderRadius: '8px',
                              fontSize: '0.9rem',
                              fontWeight: 'bold',
                              cursor: 'pointer',
                              width: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '0.5rem',
                              fontFamily: 'inherit',
                              opacity: (!manualMpesaMessage.trim() || isManualVerifying) ? 0.7 : 1
                            }}
                          >
                            {isManualVerifying ? <><Loader2 className="spin" size={16} /> Verifying...</> : 'Verify with Receipt'}
                          </button>
                        </div>
                      )}
                      
                      {!isManualVerifyOpen && stkSecondsLeft !== 0 && stkSecondsLeft !== null && stkSecondsLeft <= 90 && (
                        <button
                          onClick={() => setIsManualVerifyOpen(true)}
                          style={{ marginTop: '0.75rem', background: 'none', border: 'none', color: '#2563eb', fontSize: '0.85rem', cursor: 'pointer', textDecoration: 'underline', display: 'block', width: '100%', fontFamily: 'inherit' }}
                        >
                          Have your M-Pesa code? Verify manually
                        </button>
                      )}

                      <button
                        onClick={() => {
                          setIsPaying(false);
                          setPendingPaymentRef(null);
                          setStkSecondsLeft(null);
                          setIsManualVerifyOpen(false);
                          if (project) localStorage.removeItem(`tx_${project.id}`);
                        }}
                        style={{ marginTop: '1rem', background: 'none', border: 'none', color: '#6b7280', fontSize: '0.85rem', cursor: 'pointer', textDecoration: 'underline', display: 'block', width: '100%', fontFamily: 'inherit' }}
                      >
                        Cancel and try again
                      </button>
                    </div>
                  )}

                  <div className="secure-badges">
                    <span><Shield size={12} /> Secure M-Pesa Payment</span>
                    <span><CheckCircle size={12} /> Instant Delivery</span>
                  </div>

                  <div style={{ marginTop: '2.5rem', paddingTop: '2rem', borderTop: '1px solid var(--card-border)', textAlign: 'center' }}>
                    <Link href={`/portfolio/${project.uid}`} className="btn-text" style={{ fontWeight: '700', fontSize: '0.95rem' }}>
                      View more work from this creator <ArrowRight size={16} style={{ marginLeft: '0.5rem' }} />
                    </Link>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {otherProjects.length > 0 && (
          <div className="portfolio-section">
            <div className="section-header">
              <h2>More from this Creator</h2>
              <Link href={`/portfolio/${project.uid}`} className="btn-text">View Full Portfolio <ArrowRight size={16} /></Link>
            </div>
            <div className="portfolio-grid">
              {otherProjects.map(p => (
                <Link href={`/p/${p.id}`} key={p.id} className="portfolio-card glass-card">
                  <div className="card-thumb">
                    {p.previewUrl ? <img src={p.previewUrl} alt={p.title} /> : <div className="thumb-placeholder"><Shield opacity={0.1} /></div>}
                  </div>
                  <div className="card-meta">
                    <h3>{p.title}</h3>
                    <span>KSh {p.price?.toLocaleString()}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>

      <style jsx>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

        .preview-container { 
          min-height: 100vh; padding: 2rem; 
          background: #f8fafc; 
          font-family: 'Inter', sans-serif; 
          position: relative; overflow: hidden; 
          color: #0f172a;
        }
        
        /* Subtle background blobs for premium feel */
        .preview-container::before {
          content: ""; position: fixed; top: -20%; left: -10%; width: 60vw; height: 60vw; border-radius: 50%;
          background: radial-gradient(circle, rgba(34,197,94,0.06) 0%, transparent 70%);
          z-index: 0; pointer-events: none;
        }
        .preview-container::after {
          content: ""; position: fixed; bottom: -20%; right: -10%; width: 70vw; height: 70vw; border-radius: 50%;
          background: radial-gradient(circle, rgba(59,130,246,0.05) 0%, transparent 70%);
          z-index: 0; pointer-events: none;
        }

        /* Ensure content sits above background blobs */
        .preview-nav, .preview-content, .portfolio-section { position: relative; z-index: 1; }

        /* Glassmorphism primitives */
        .glass-card {
          background: rgba(255, 255, 255, 0.75);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.9);
          box-shadow: 0 10px 40px -10px rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.02);
          border-radius: 24px;
        }

        /* Nav */
        .preview-nav { 
          display: flex; justify-content: space-between; align-items: center; 
          max-width: 1100px; margin: 0 auto 3rem; 
          background: rgba(255,255,255,0.65); padding: 0.8rem 1.5rem; 
          border-radius: 100px; backdrop-filter: blur(12px); 
          border: 1px solid rgba(255,255,255,0.8); 
          box-shadow: 0 4px 20px rgba(0,0,0,0.02); 
        }
        .logo { font-size: 1.3rem; font-weight: 800; color: #0f172a; text-decoration: none; letter-spacing: -0.03em; }
        .logo span { color: #22c55e; }
        .nav-badges { display: flex; gap: 0.8rem; }
        .badge { 
          display: flex; align-items: center; gap: 0.4rem; 
          padding: 0.4rem 0.9rem; border-radius: 100px; 
          font-size: 0.75rem; background: #fff; color: #334155; 
          font-weight: 600; box-shadow: 0 2px 8px rgba(0,0,0,0.04); 
        }

        /* Main Grid */
        .preview-content { max-width: 1100px; margin: 0 auto; }
        .preview-grid { display: grid; grid-template-columns: 1fr 420px; gap: 2.5rem; margin-bottom: 4rem; align-items: start; }
        
        /* Visual Panel */
        .preview-visual { 
          position: relative; overflow: hidden; height: auto; aspect-ratio: 4/3; 
          display: flex; align-items: center; justify-content: center; 
          background: #fff; padding: 0.5rem; 
        }
        .visual-wrapper { 
          width: 100%; height: 100%; position: relative; 
          display: flex; align-items: center; justify-content: center; 
          transition: filter 0.5s ease; border-radius: 20px; 
          overflow: hidden; background: #f1f5f9; 
        }
        .media-blurred { filter: blur(24px) saturate(0.8); transform: scale(1.02); }
        .preview-media { max-width: 100%; max-height: 100%; object-fit: contain; }
        
        /* Overlays */
        .preview-overlay { 
          position: absolute; inset: 0; background: rgba(255,255,255,0.1); 
          display: flex; flex-direction: column; align-items: center; justify-content: center; 
          gap: 1rem; font-weight: bold; transition: all 0.5s ease; z-index: 10; 
        }
        .blurred-overlay { background: rgba(255,255,255,0.4); backdrop-filter: blur(2px); }
        .timer-badge { 
          position: absolute; top: 1.5rem; right: 1.5rem; 
          background: rgba(255,255,255,0.95); color: #0f172a; 
          padding: 0.5rem 1rem; border-radius: 100px; font-size: 0.8rem; font-weight: 700;
          border: 1px solid rgba(0,0,0,0.05); box-shadow: 0 4px 15px rgba(0,0,0,0.05); 
        }
        .start-preview-btn { 
          background: #0f172a; color: white; padding: 1rem 2rem; border-radius: 100px; 
          font-weight: 700; font-size: 0.9rem; cursor: pointer; 
          box-shadow: 0 10px 25px rgba(15,23,42,0.2); 
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .start-preview-btn:hover { transform: translateY(-2px); box-shadow: 0 15px 30px rgba(15,23,42,0.3); }
        .lock-icon { color: #0f172a; background: #fff; padding: 1rem; border-radius: 50%; box-shadow: 0 10px 30px rgba(0,0,0,0.08); }

        /* Payment Panel */
        .preview-info { padding: 2.5rem; display: flex; flex-direction: column; gap: 1.5rem; }
        .category-tag { 
          background: #f1f5f9; color: #475569; padding: 0.4rem 0.8rem; 
          border-radius: 8px; font-size: 0.75rem; font-weight: 700; 
          display: inline-block; width: fit-content; text-transform: uppercase; letter-spacing: 0.05em;
        }
        .info-header h1 { font-size: 1.8rem; font-weight: 800; color: #0f172a; letter-spacing: -0.03em; margin: 0.5rem 0; line-height: 1.2; }
        .file-meta { display: flex; gap: 0.8rem; color: #64748b; font-size: 0.85rem; font-weight: 500; }
        
        .price-card { 
          background: #fff; padding: 1.5rem; border-radius: 16px; 
          display: flex; flex-direction: column; gap: 0.2rem; 
          border: 1px solid rgba(0,0,0,0.04); box-shadow: 0 4px 15px rgba(0,0,0,0.02);
        }
        .price-label { font-size: 0.85rem; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
        .price-amount { font-size: 2.5rem; font-weight: 900; color: #22c55e; letter-spacing: -0.04em; }
        
        .input-group label { display: block; margin-bottom: 0.6rem; font-size: 0.85rem; font-weight: 600; color: #334155; }
        .input-group input { 
          width: 100%; padding: 0.9rem 1rem; border-radius: 12px; 
          background: #fff; border: 1px solid #cbd5e1; color: #0f172a; 
          font-family: inherit; font-size: 0.95rem; font-weight: 500;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .input-group input:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 4px rgba(59,130,246,0.1); }
        .input-group input::placeholder { color: #94a3b8; }
        
        .btn-unlock { 
          width: 100%; padding: 1.2rem; font-weight: 800; font-size: 1.05rem; 
          border-radius: 16px; background: linear-gradient(135deg, #22c55e, #16a34a);
          box-shadow: 0 8px 25px rgba(34,197,94,0.3); color: #fff; border: none;
          display: flex; align-items: center; justify-content: center; gap: 0.5rem;
          cursor: pointer; transition: transform 0.2s, box-shadow 0.2s;
        }
        .btn-unlock:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 12px 30px rgba(34,197,94,0.4); }
        .btn-unlock:disabled { background: #94a3b8; box-shadow: none; cursor: not-allowed; opacity: 0.7; }
        
        .btn-secondary {
          background: #f1f5f9; color: #0f172a; border: none; padding: 0.9rem 1.2rem;
          border-radius: 12px; font-weight: 600; cursor: pointer; transition: background 0.2s;
        }
        .btn-secondary:hover:not(:disabled) { background: #e2e8f0; }

        .secure-badges { display: flex; justify-content: center; gap: 1.5rem; margin-top: 1.5rem; color: #64748b; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
        .secure-badges span { display: flex; align-items: center; gap: 0.3rem; }
        
        .paid-success { text-align: center; padding: 2rem 0; animation: scaleIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
        .icon-success { color: #22c55e; margin-bottom: 1rem; }
        .paid-success h2 { margin-bottom: 1.5rem; font-size: 1.5rem; font-weight: 800; color: #0f172a; }
        
        /* Portfolio Section */
        .portfolio-section { margin-top: 5rem; }
        .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
        .section-header h2 { font-size: 1.4rem; font-weight: 800; color: #0f172a; letter-spacing: -0.02em; }
        .btn-text { color: #3b82f6; text-decoration: none; font-weight: 700; display: inline-flex; align-items: center; transition: opacity 0.2s; }
        .btn-text:hover { opacity: 0.7; }
        
        .portfolio-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.5rem; }
        .portfolio-card { 
          text-decoration: none; color: inherit; overflow: hidden; 
          border-radius: 20px; transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s; 
          background: #fff; border: 1px solid rgba(0,0,0,0.04);
        }
        .portfolio-card:hover { transform: translateY(-6px); box-shadow: 0 20px 40px rgba(0,0,0,0.08); border-color: rgba(34,197,94,0.3); }
        .card-thumb { height: 180px; background: #f8fafc; }
        .card-thumb img { width: 100%; height: 100%; object-fit: cover; }
        .card-meta { padding: 1.25rem; display: flex; justify-content: space-between; align-items: center; }
        .card-meta h3 { font-size: 0.95rem; font-weight: 700; color: #0f172a; }
        .card-meta span { font-weight: 800; color: #16a34a; font-size: 0.9rem; }
        
        .preview-loading { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem; color: #64748b; font-weight: 600; }
        .preview-error { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1.5rem; text-align: center; padding: 2rem; }
        .preview-error h1 { font-size: 4rem; margin-bottom: 0; }
        
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        
        @media (max-width: 900px) {
          .preview-grid { grid-template-columns: 1fr; gap: 1.5rem; }
          .preview-visual { height: auto; aspect-ratio: 16/9; }
          .preview-info { padding: 2rem; }
        }
        
        @media (max-width: 600px) {
          .preview-container { padding: 1rem; }
          .preview-nav { margin-bottom: 1.5rem; flex-direction: column; gap: 1rem; padding: 1rem; border-radius: 20px; }
          .nav-badges { flex-wrap: wrap; justify-content: center; }
          .logo { font-size: 1.4rem; }
          .preview-visual { aspect-ratio: 1; }
          .price-amount { font-size: 2.2rem; }
          .btn-unlock { padding: 1rem; font-size: 1rem; }
          .info-header h1 { font-size: 1.5rem; }
          .preview-info { padding: 1.5rem; }
        }
      `}</style>
    </div>
  );
}
