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
  const [transactionId, setTransactionId] = useState(null);
const paymentWindowRef = useRef(null);
  const [email, setEmail] = useState('');
  const router = useRouter();
  const [customPrice, setCustomPrice] = useState('');
  const [discountCode, setDiscountCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState(null);
  const [discountError, setDiscountError] = useState('');
  const [isApplyingDiscount, setIsApplyingDiscount] = useState(false);
  const [toast, setToast] = useState(null);
const [autoDownloaded, setAutoDownloaded] = useState(false);


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

// Listen for Paywave payment success messages
useEffect(() => {
  const handleMessage = (event) => {
    if (event.data?.type === 'PAYWAVE_SUCCESS') {
      setIsPaid(true);
      setIsPaying(false);
      if (typeof window !== 'undefined') {
        localStorage.setItem(`paid_${project?.id}`, 'true');
      }
      setToast({ message: "Payment confirmed successfully!", type: "success" });
      // Close the Paywave popup if still open
      if (paymentWindowRef.current && !paymentWindowRef.current.closed) {
        paymentWindowRef.current.close();
      }
      // Refresh the page to reflect unlocked content
      router.replace(router.asPath);
    }
  };
  window.addEventListener('message', handleMessage);
  return () => window.removeEventListener('message', handleMessage);
}, [project]);

// Auto‑download files once payment is confirmed
useEffect(() => {
  if (isPaid && !autoDownloaded && transactionId && project) {
    const filesToDownload = project.files && project.files.length > 0
      ? project.files
      : [{ fileName: project.fileName, originalUrl: project.originalUrl }];

    filesToDownload.forEach(async (f, idx) => {
      const safeName = (f.fileName || project.title || `file_${idx}`).replace(/[^a-z0-9.]/gi, '_');
      try {
        const downloadUrl = `/api/download/${project.id}?t=${transactionId}${project.files && project.files.length > 0 ? `&index=${idx}` : ''}`;
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
        console.error('Auto‑download error:', err);
      }
    });
    setAutoDownloaded(true);
  }
}, [isPaid, transactionId, project, autoDownloaded]);

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

  const handlePayment = async () => {
    if (!phoneNumber) return;
    setIsPaying(true);
    setError(null);

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

      // Open Paywave checkout in a new window and keep a reference
      if (data.authorization_url) {
        const pwWindow = window.open(data.authorization_url, '_blank');
        paymentWindowRef.current = pwWindow;
      }

      setTransactionId(data.transactionId);
      
      // Poll for transaction status
      const pollTransaction = async () => {
        const checkStatus = async () => {
          try {
            const transSnap = await getDoc(doc(db, 'transactions', data.transactionId));
            if (transSnap.exists()) {
              const transData = transSnap.data();
                if (transData.status === 'completed') {
                  setIsPaid(true);
                  setIsPaying(false);
                  if (typeof window !== 'undefined') {
                    localStorage.setItem(`paid_${project?.id}`, 'true');
                  }
                  setToast({ message: "Payment confirmed successfully!", type: "success" });
                  // Close the Paywave window if it's still open
                  if (paymentWindowRef.current && !paymentWindowRef.current.closed) {
                    paymentWindowRef.current.close();
                    paymentWindowRef.current = null;
                  }
                  return true; // Stop polling
                } else if (transData.status === 'failed') {
                setError(`Payment failed: ${transData.failureReason || 'Unknown error'}`);
                setToast({ message: "Payment failed. Please try again.", type: "error" });
                setIsPaying(false);
                return true; // Stop polling
              }
            }
            return false;
          } catch (err) {
            console.error("Polling error:", err);
            return false;
          }
        };

        const interval = setInterval(async () => {
          const finished = await checkStatus();
          if (finished) clearInterval(interval);
        }, 3000);

        // Timeout after 2 minutes
        setTimeout(() => {
          clearInterval(interval);
          if (!isPaid && isPaying) {
            setError("Payment confirmation timed out. If you've paid, please refresh the page.");
            setToast({ message: "Payment timed out.", type: "error" });
            setIsPaying(false);
          }
        }, 120000);
      };

      pollTransaction();

    } catch (err) {
      console.error('Payment error:', err);
      setError(err.message);
      setToast({ message: err.message, type: "error" });
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
                      if (!transactionId) {
                        alert("Transaction not found. Please refresh and try again.");
                        return;
                      }

                      try {
                        const downloadUrl = `/api/download/${project.id}?t=${transactionId}${project.files && project.files.length > 0 ? `&index=${index}` : ''}`;
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
                    {isPaying ? <Loader2 className="spin" size={20} /> : `Pay & Unlock (KSh ${paymentBreakdown?.total?.toLocaleString()})`}
                  </button>

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
        .preview-container { min-height: 100vh; padding: 2rem; background: var(--background); }
        .preview-nav { display: flex; justify-content: space-between; align-items: center; max-width: 1200px; margin: 0 auto 3rem; }
        .logo { font-size: 1.5rem; font-weight: 800; color: #000; text-decoration: none; }
        .logo span { color: var(--primary); }
        .nav-badges { display: flex; gap: 1rem; }
        .badge { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; border-radius: 20px; font-size: 0.8rem; background: rgba(0,0,0,0.05); color: #475569; }
        .preview-content { max-width: 1200px; margin: 0 auto; }
        .preview-grid { display: grid; grid-template-columns: 1fr 400px; gap: 2rem; margin-bottom: 4rem; }
        .preview-visual { position: relative; border-radius: 24px; overflow: hidden; height: 600px; display: flex; align-items: center; justify-content: center; background: #f8fafc; border: 1px solid var(--card-border); }
        .visual-wrapper { width: 100%; height: 100%; position: relative; display: flex; align-items: center; justify-content: center; transition: filter 0.5s ease; }
        .media-blurred { filter: blur(20px); }
        .preview-media { max-width: 100%; max-height: 100%; object-fit: contain; }
        .preview-overlay { position: absolute; inset: 0; background: rgba(255,255,255,0.1); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem; font-weight: bold; transition: background 0.5s ease; z-index: 10; }
        .blurred-overlay { background: rgba(255,255,255,0.6); backdrop-filter: blur(4px); }
        .timer-badge { position: absolute; top: 1.5rem; right: 1.5rem; background: rgba(255,255,255,0.9); color: #000; padding: 0.5rem 1rem; border-radius: 20px; font-size: 0.8rem; border: 1px solid var(--primary); box-shadow: var(--shadow); }
        .start-preview-btn { background: var(--primary); color: white; padding: 1rem 2rem; border-radius: 50px; cursor: pointer; box-shadow: 0 10px 20px var(--primary-glow); }
        .lock-icon { color: var(--primary); }
        .preview-info { padding: 3rem; border-radius: 24px; display: flex; flex-direction: column; gap: 2rem; border: 1px solid var(--card-border); }
        .category-tag { background: #F0FDF4; color: #166534; padding: 0.4rem 0.8rem; border-radius: 8px; font-size: 0.75rem; font-weight: 800; display: inline-block; width: fit-content; border: 1px solid rgba(22, 101, 52, 0.1); }
        .file-meta { display: flex; gap: 0.8rem; opacity: 0.5; font-size: 0.9rem; margin-top: 0.5rem; color: #000; }
        .price-card { background: #f8fafc; padding: 1.5rem; border-radius: 16px; display: flex; flex-direction: column; gap: 0.5rem; border: 1px solid var(--card-border); }
        .price-label { font-size: 0.9rem; opacity: 0.6; color: #000; }
        .price-amount { font-size: 2rem; font-weight: 800; color: #000; }
        .breakdown { padding: 1rem 0; border-bottom: 1px solid var(--card-border); margin-bottom: 1rem; }
        .breakdown-item { display: flex; justify-content: space-between; font-size: 0.9rem; opacity: 0.6; margin-bottom: 0.5rem; color: #000; }
        .breakdown-total { display: flex; justify-content: space-between; font-weight: 800; font-size: 1.1rem; color: var(--primary); }
        .input-group label { display: block; margin-bottom: 0.8rem; font-size: 0.9rem; opacity: 0.8; color: #000; }
        .input-group input { width: 100%; padding: 1rem; border-radius: 12px; background: #FFFFFF; border: 1px solid var(--card-border); color: #000; margin-bottom: 1.5rem; }
        .btn-unlock { width: 100%; padding: 1.2rem; font-weight: 800; font-size: 1.1rem; }
        .secure-badges { display: flex; justify-content: center; gap: 1.5rem; margin-top: 1.5rem; opacity: 0.4; font-size: 0.75rem; color: #000; }
        .secure-badges span { display: flex; align-items: center; gap: 0.4rem; }
        .paid-success { text-align: center; padding: 2rem 0; animation: scaleIn 0.5s ease-out; }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
        .icon-success { color: #10b981; margin-bottom: 1.5rem; }
        .paid-success h2 { margin-bottom: 1rem; }
        .portfolio-section { margin-top: 4rem; }
        .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
        .portfolio-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 1.5rem; }
        .portfolio-card { text-decoration: none; color: inherit; overflow: hidden; transition: transform 0.3s; }
        .portfolio-card:hover { transform: translateY(-5px); }
        .card-thumb { height: 160px; background: rgba(255,255,255,0.02); }
        .card-thumb img { width: 100%; height: 100%; object-fit: cover; }
        .card-meta { padding: 1.2rem; display: flex; justify-content: space-between; align-items: center; }
        .card-meta h3 { font-size: 1rem; font-weight: 600; }
        .preview-loading { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem; opacity: 0.6; }
        .preview-error { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1.5rem; text-align: center; padding: 2rem; }
        .preview-error h1 { font-size: 3rem; margin-bottom: 0; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media (max-width: 900px) {
          .preview-grid { grid-template-columns: 1fr; }
          .preview-visual { height: 400px; border-radius: 16px; }
          .preview-info { padding: 2rem; border-radius: 16px; }
        }

        @media (max-width: 600px) {
          .preview-container { padding: 1rem; }
          .preview-nav { margin-bottom: 1.5rem; flex-direction: column; gap: 1rem; }
          .nav-badges { display: flex; flex-wrap: wrap; justify-content: center; }
          .logo { font-size: 1.4rem; }
          .preview-visual { height: 280px; }
          .price-amount { font-size: 1.8rem; }
          .btn-unlock { padding: 1rem; font-size: 1rem; }
          .info-header h1 { font-size: 1.5rem; }
        }
      `}</style>
    </div>
  );
}
