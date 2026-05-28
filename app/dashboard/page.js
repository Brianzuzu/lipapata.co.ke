'use client';

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Upload, Plus, FileText, Banknote, Share2, Loader2, Link as LinkIcon, Home, Image, Film, AlertCircle, CheckCircle2, Clock, ExternalLink, Music, Archive, Tag } from 'lucide-react';
import { collection, addDoc, serverTimestamp, query, where, getDocs, orderBy, doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { validateUpload, UPLOAD_LIMITS } from '../../lib/uploadConfig';
import { calculateCommission } from '../../lib/commission';
import Link from 'next/link';


export default function Dashboard() {
  const [isUploading, setIsUploading] = useState(false);
  const [files, setFiles] = useState([]);
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [isPWYW, setIsPWYW] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawPhone, setWithdrawPhone] = useState('');
  const [withdrawalMessage, setWithdrawalMessage] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [uploadError, setUploadError] = useState('');
  const [projects, setProjects] = useState([]);
  const [uploadCount, setUploadCount] = useState(0);
  const [pendingWithdrawal, setPendingWithdrawal] = useState(0);
  const [totalWithdrawn, setTotalWithdrawn] = useState(0);
  const [withdrawals, setWithdrawals] = useState([]);
  const [fetchError, setFetchError] = useState(null);
  const [audience, setAudience] = useState([]);
  
  // Discount State
  const [isDiscounting, setIsDiscounting] = useState(false);
  const [discountProject, setDiscountProject] = useState(null);
  const [discountCode, setDiscountCode] = useState('');
  const [discountType, setDiscountType] = useState('percentage');
  const [discountValue, setDiscountValue] = useState('');

  // Profile State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileData, setProfileData] = useState({
    bio: '',
    website: '',
    twitter: '',
    instagram: '',
    coverPhotoUrl: ''
  });

  const userPlan = 'FREE'; // Will be dynamic later
  
  const fileInputRef = useRef(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Fetch extra user data
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          setUserData(userDoc.data());
          setWithdrawPhone(userDoc.data().phone || '');
        } else {
          // If profile is missing (due to previous permission error), 
          // we set a basic fallback and "heal" the database by creating it now
          const fallbackData = {
            uid: currentUser.uid,
            name: currentUser.displayName || currentUser.email?.split('@')[0] || 'Creator',
            email: currentUser.email,
            role: 'creator',
            createdAt: new Date().toISOString()
          };
          setUserData(fallbackData);
          setDoc(doc(db, 'users', currentUser.uid), fallbackData).catch(err => console.error("Database healing failed:", err));
        }
        fetchProjects(currentUser.uid);
      } else {
        setProjects([]);
        setUploadCount(0);
        setUserData(null);
      }
      setLoadingUser(false);
    });
    return () => unsubscribe();
  }, []);

  const [totalEarned, setTotalEarned] = useState(0);

  const fetchProjects = async (uid) => {
    try {
      // Fetch Projects (Removed orderBy to avoid composite index requirement)
      const qProj = query(
        collection(db, 'projects'),
        where('uid', '==', uid)
      );
      const snapshotProj = await getDocs(qProj);
      
      // Sort client-side instead so it "just works" without manual indexes
      const projectList = snapshotProj.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => {
          const dateA = a.createdAt?.toDate?.() || new Date(0);
          const dateB = b.createdAt?.toDate?.() || new Date(0);
          return dateB - dateA;
        });

      setProjects(projectList);
      setUploadCount(projectList.length);

      // Fetch Completed Transactions for Earnings
      const qTrans = query(
        collection(db, 'transactions'),
        where('creatorUid', '==', uid),
        where('status', '==', 'completed')
      );
      const snapshotTrans = await getDocs(qTrans);
      const transList = snapshotTrans.docs.map(doc => ({id: doc.id, ...doc.data()}));
      const earnings = transList.reduce((acc, data) => acc + (data.creatorEarnings || 0), 0);
      setTotalEarned(earnings);

      const uniqueAudience = [];
      const seenEmails = new Set();
      transList.forEach(t => {
        const email = t.customerEmail || t.paystackData?.customer?.email;
        if (email && !seenEmails.has(email)) {
          seenEmails.add(email);
          uniqueAudience.push({ 
            email: email, 
            lastPurchase: t.createdAt?.toDate?.() || new Date(0),
            totalSpent: transList.filter(x => (x.customerEmail || x.paystackData?.customer?.email) === email).reduce((sum, x) => sum + (x.amount || 0), 0)
          });
        }
      });

      // Load profile
      getDoc(doc(db, 'users', uid)).then(d => {
        if (d.exists()) {
          const data = d.data();
          setProfileData(prev => ({
            ...prev,
            bio: data.bio || '',
            website: data.website || '',
            twitter: data.twitter || '',
            instagram: data.instagram || '',
            coverPhotoUrl: data.coverPhotoUrl || ''
          }));
        }
      });

      setAudience(uniqueAudience.sort((a, b) => b.lastPurchase - a.lastPurchase));

      // Fetch Pending Withdrawals
      const qWith = query(
        collection(db, 'withdrawals'),
        where('creatorUid', '==', uid),
        where('status', '==', 'pending')
      );
      const snapshotWith = await getDocs(qWith);
      const pendingTotal = snapshotWith.docs.reduce((acc, doc) => acc + (doc.data().amount || 0), 0);
      setPendingWithdrawal(pendingTotal);

      // Fetch Completed Withdrawals
      const qCompWith = query(
        collection(db, 'withdrawals'),
        where('creatorUid', '==', uid),
        where('status', '==', 'completed')
      );
      const snapshotCompWith = await getDocs(qCompWith);
      const withdrawnTotal = snapshotCompWith.docs.reduce((acc, doc) => acc + (doc.data().amount || 0), 0);
      setTotalWithdrawn(withdrawnTotal);

      // Fetch All Withdrawals for History
      const qAllWith = query(
        collection(db, 'withdrawals'),
        where('creatorUid', '==', uid)
      );
      const snapshotAllWith = await getDocs(qAllWith);
      const withList = snapshotAllWith.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => {
          const dateA = a.createdAt?.toDate?.() || new Date(0);
          const dateB = b.createdAt?.toDate?.() || new Date(0);
          return dateB - dateA;
        });
      setWithdrawals(withList);

      setFetchError(null);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setFetchError("Could not load dashboard data. Please check your connection.");
    }
  };

  const handleFileChange = (e) => {
    setUploadError('');
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files);
      
      // Client-side validation
      for (const f of selectedFiles) {
        const validation = validateUpload(f, userPlan);
        if (!validation.valid) {
          setUploadError(`Error with ${f.name}: ${validation.error}`);
          return;
        }
      }

      // Removed upload count limit check

      setFiles(prev => [...prev, ...selectedFiles]);
    }
  };

  const handleUpload = async () => {
    console.log('🚀 handleUpload triggered', { filesCount: files.length, title, price, user: !!user });
    
    if (files.length === 0 || !title || !price) {
      console.warn('⚠️ Validation failed', { filesCount: files.length, title, price });
      alert("Please select at least one file, enter a title, and set a price.");
      return;
    }

    setIsProcessing(true);
    setUploadError('');
    setUploadProgress(10);

    let uploadedFilesData = [];

    try {
      // 1. Upload to Cloudinary via our API route
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('file', file);
        formData.append('plan', userPlan);
        formData.append('creatorName', userData?.name || 'Creator');

        console.log(`📤 Sending file ${i + 1} of ${files.length} to API...`);
        setUploadProgress(10 + Math.floor((i / files.length) * 60));

        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!uploadRes.ok) {
          const errData = await uploadRes.json();
          throw new Error(errData.error || `Upload failed for ${file.name}`);
        }

        const cloudData = await uploadRes.json();
        console.log(`✅ Cloudinary success for ${file.name}`, cloudData);
        
        uploadedFilesData.push({
          originalUrl: cloudData?.original?.url || '',
          originalPublicId: cloudData?.original?.publicId || '',
          previewUrl: cloudData?.preview?.url || '',
          resourceType: cloudData?.original?.resourceType || 'raw',
          format: cloudData?.original?.format || 'unknown',
          fileSize: cloudData?.original?.bytes || 0,
          fileName: file?.name || 'file'
        });
      }

      setUploadProgress(85);

      // 2. Save project metadata to Firestore
      const mainFile = uploadedFilesData[0] || {};
      const docRef = await addDoc(collection(db, 'projects'), {
        uid: user?.uid || 'guest-user',
        title: title || 'Untitled Project',
        price: parseFloat(price) || 0,
        files: uploadedFilesData, // Store all files
        // Maintain backwards compatibility
        originalUrl: mainFile.originalUrl || '',
        originalPublicId: mainFile.originalPublicId || '',
        previewUrl: mainFile.previewUrl || '',
        resourceType: mainFile.resourceType || 'raw',
        format: mainFile.format || 'unknown',
        fileSize: mainFile.fileSize || 0,
        fileName: mainFile.fileName || 'file',
        createdAt: serverTimestamp(),
        status: 'Pending',
        isPWYW: isPWYW,
        // Auto-delete tracking
        expiresAfterDelivery: true,
        expiryDays: 30,
        lastUpdated: serverTimestamp(),
      });
      
      setUploadProgress(100);
      console.log('🎉 Firestore success', docRef.id);

      // 3. Refresh project list
      if (user?.uid) fetchProjects(user.uid);

      // 4. Generate shareable link
      const link = `${window.location.origin}/p/${docRef.id}`;
      setGeneratedLink(link);
      setIsProcessing(false);
      setUploadCount(prev => prev + 1);
    } catch (error) {
      console.error("❌ Upload error:", error);
      setUploadError(error.message || "Upload failed. Please check your connection.");
      setIsProcessing(false);
      setUploadProgress(0);
    }
  };

  const handleWithdrawalRequest = async (e) => {
    e.preventDefault();
    const availableBalance = totalEarned - totalWithdrawn;
    
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) return;
    if (parseFloat(withdrawAmount) < 500) {
      setWithdrawalMessage({ type: 'error', text: 'Minimum withdrawal amount is KSh 500' });
      return;
    }
    if (parseFloat(withdrawAmount) > availableBalance) {
      setWithdrawalMessage({ type: 'error', text: 'Insufficient balance' });
      return;
    }

    // Security: Rate Limiting - Max 1 withdrawal per 24 hours
    const today = new Date().setHours(0, 0, 0, 0);
    const hasWithdrawnToday = withdrawals.some(w => {
      const withDate = w.createdAt?.toDate ? w.createdAt.toDate().setHours(0, 0, 0, 0) : 0;
      return withDate === today;
    });

    if (hasWithdrawnToday) {
      setWithdrawalMessage({ type: 'error', text: 'Security Limit: Only 1 withdrawal allowed per day.' });
      return;
    }

    setIsProcessing(true);
    try {
      const amount = parseFloat(withdrawAmount);
      
      // Calculate tiered transfer fee for transparency
      let fee = 20;
      if (amount > 20000) fee = 60;
      else if (amount > 1500) fee = 40;

      const netAmount = amount - fee;

      // Future Safaricom B2C Automation:
      // If amount < 2000 and the system is fully tested, we could set status: 'approved' 
      // or trigger an API call here. For now, all require admin approval (Maker-Checker).
      const autoApproveLimit = 2000;
      const initialStatus = 'pending'; // Change to (netAmount <= autoApproveLimit ? 'approved' : 'pending') later

      await addDoc(collection(db, 'withdrawals'), {
        creatorUid: user.uid,
        creatorName: userData?.name || 'Creator',
        amount: amount,
        fee: fee,
        netAmount: netAmount,
        phoneNumber: withdrawPhone,
        status: initialStatus,
        createdAt: serverTimestamp()
      });
      setWithdrawalMessage({ type: 'success', text: 'Request sent, waiting for confirmation' });
      // Refresh pending status
      if (user?.uid) fetchProjects(user.uid);
      setWithdrawAmount('');
    } catch (err) {
      setWithdrawalMessage({ type: 'error', text: 'Failed to send request. Try again.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateDiscount = async (e) => {
    e.preventDefault();
    if (!discountCode || !discountValue || !discountProject) return;
    setIsProcessing(true);
    try {
      await addDoc(collection(db, 'discounts'), {
        projectId: discountProject.id,
        creatorUid: user?.uid,
        code: discountCode.toUpperCase(),
        type: discountType,
        value: parseFloat(discountValue),
        active: true,
        createdAt: serverTimestamp()
      });
      setIsDiscounting(false);
      setDiscountCode('');
      setDiscountValue('');
      setDiscountProject(null);
      alert('Discount code created successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to create discount');
    } finally {
      setIsProcessing(false);
    }
  };

  const exportAudienceCSV = () => {
    if (audience.length === 0) return;
    const headers = ['Email,Last Purchase Date,Total Spent (KSh)'];
    const rows = audience.map(a => `${a.email},${a.lastPurchase.toLocaleDateString()},${a.totalSpent}`);
    const csvContent = "data:text/csv;charset=utf-8," + headers.concat(rows).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "lipapata_audience.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      await setDoc(doc(db, 'users', user.uid), profileData, { merge: true });
      setIsEditingProfile(false);
      alert('Profile updated successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to update profile');
    } finally {
      setIsProcessing(false);
    }
  };

  // Redirect if not logged in
  useEffect(() => {
    if (!loadingUser && !user) {
      window.location.href = '/login';
    }
  }, [user, loadingUser]);

  if (loadingUser) {
    return <div className="loading-screen"><Loader2 className="spin" /></div>;
  }

  if (!user) return null;

  const resetModal = () => {
    setIsUploading(false);
    setFiles([]);
    setTitle('');
    setPrice('');
    setIsPWYW(false);
    setUploadProgress(0);
    setGeneratedLink('');
    setUploadError('');
  };

  const getFileIcon = (f) => {
    if (!f) return <Upload size={40} className="icon-primary" />;
    if (f.type.startsWith('image/')) return <Image size={40} className="icon-primary" />;
    if (f.type.startsWith('video/')) return <Film size={40} className="icon-primary" />;
    if (f.type.startsWith('audio/')) return <Music size={40} className="icon-primary" />;
    if (f.name?.endsWith('.zip') || f.type.includes('zip') || f.type.includes('archive')) return <Archive size={40} className="icon-primary" />;
    return <FileText size={40} className="icon-primary" />;
  };

  const limits = UPLOAD_LIMITS[userPlan];

  return (
    <div className="dashboard-container">
      <header className="dash-header">
        <div className="header-left" style={{ display: 'flex', alignItems: 'center', gap: '1.2rem' }}>
          <Link href="/" style={{ textDecoration: 'none', color: 'inherit' }}>
            <img src="/logo-v2.png" alt="Lipapata Logo" style={{ width: '100px', height: '100px', objectFit: 'contain', mixBlendMode: 'darken' }} />
          </Link>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h1>{userData?.name ? `${userData.name}'s Dashboard` : userData?.email ? `${userData.email}'s Dashboard` : 'Creator Dashboard'}</h1>
            {user?.uid && (
              <Link href={`/portfolio/${user.uid}`} className="btn-text" style={{ fontSize: '0.9rem', width: 'fit-content' }}>
                View My Public Portfolio →
              </Link>
            )}
          </div>
        </div>
        <div className="header-right">
          <button className="btn-secondary" onClick={() => setIsEditingProfile(true)}>
            Storefront Settings
          </button>
          <button className="btn-primary" onClick={() => setIsUploading(true)}>
            <Plus size={18} /> New Project
          </button>
        </div>
      </header>

      <section className="stats-grid">
        <div className="stat-card-wrapper">
          <StatCard 
            title="Available Balance" 
            value={`KSh ${(totalEarned - totalWithdrawn).toLocaleString()}`} 
            icon={<Banknote color="#10b981" />} 
          />
          <button className="btn-withdraw" onClick={() => setIsWithdrawing(true)}>Withdraw</button>
        </div>
        <StatCard title="Total Earned" value={`KSh ${totalEarned.toLocaleString()}`} icon={<CheckCircle2 opacity={0.5} />} />
        <StatCard title="Withdrawn" value={`KSh ${totalWithdrawn.toLocaleString()}`} icon={<ExternalLink size={20} opacity={0.5} />} />
      </section>

      {pendingWithdrawal > 0 && (
        <div className="pending-notice">
          <Clock className="spin-slow" size={18} />
          <span>You have a pending withdrawal of <strong>KSh {pendingWithdrawal.toLocaleString()}</strong>. Our team is processing it.</span>
        </div>
      )}

      <section className="projects-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h2>Your Projects</h2>
        </div>
        {fetchError && (
          <div className="upload-error" style={{ marginBottom: '2rem' }}>
            <AlertCircle size={18} />
            <span>{fetchError}</span>
          </div>
        )}
        <div className="projects-grid">
          {projects.length > 0 ? (
            projects.map((proj) => (
              <ProjectRow
                key={proj.id}
                id={proj.id}
                title={proj.title || proj.fileName}
                price={`KSh ${parseFloat(proj.price || 0).toLocaleString()}`}
                status={proj.status || 'Pending'}
                date={proj.createdAt?.toDate ? proj.createdAt.toDate().toLocaleDateString() : 'Just now'}
                resourceType={proj.resourceType}
                fileSize={proj.fileSize}
                views={proj.views}
                sales={proj.sales}
                onAddDiscount={setDiscountProject}
              />
            ))
          ) : (
            <div className="empty-state">
              <p>No projects yet. Click "New Project" to start.</p>
            </div>
          )}
        </div>
      </section>

      <section className="payouts-section" style={{ marginTop: '4rem' }}>
        <h2>Payout History</h2>
        <div className="payouts-list glass-card">
          {withdrawals.length > 0 ? (
            <table className="payout-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Destination</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {withdrawals.map((w) => (
                  <tr key={w.id}>
                    <td>{w.createdAt?.toDate ? w.createdAt.toDate().toLocaleDateString() : 'Pending'}</td>
                    <td><strong>KSh {w.amount?.toLocaleString()}</strong></td>
                    <td>{w.phoneNumber}</td>
                    <td>
                      <span className={`status-pill ${w.status}`}>
                        {w.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">
              <p>No withdrawal history yet.</p>
            </div>
          )}
        </div>
      </section>

      <section className="audience-section" style={{ marginTop: '4rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h2>Your Audience</h2>
          {audience.length > 0 && (
            <button className="btn-secondary" onClick={exportAudienceCSV}>
              Export to CSV
            </button>
          )}
        </div>
        <div className="audience-list glass-card">
          {audience.length > 0 ? (
            <table className="payout-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Last Purchase</th>
                  <th>Total Spent</th>
                </tr>
              </thead>
              <tbody>
                {audience.map((a, idx) => (
                  <tr key={idx}>
                    <td>{a.email}</td>
                    <td>{a.lastPurchase.toLocaleDateString()}</td>
                    <td><strong>KSh {a.totalSpent?.toLocaleString()}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">
              <p>No audience members yet. They will appear here when they buy your products.</p>
            </div>
          )}
        </div>
      </section>

      {isUploading && (
        <div className="modal-overlay">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="upload-modal glass-card"
          >
            <h3>{generatedLink ? 'Project Created!' : 'Upload New Work'}</h3>
            
            {!generatedLink ? (
              <>
                {uploadError && (
                  <div className="upload-error">
                    <AlertCircle size={18} />
                    <span>{uploadError}</span>
                  </div>
                )}

                <div 
                  className="upload-dropzone" 
                  onClick={() => fileInputRef.current.click()}
                  style={{ borderColor: files.length > 0 ? 'var(--primary)' : '' }}
                >
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    accept="image/*,video/*,audio/*,.pdf,.zip,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.epub,.txt,.psd,.ai,.fig,.ttf,.otf"
                    multiple
                    style={{ display: 'none' }} 
                  />
                  {files.length > 0 ? (
                    <div className="selected-files-list">
                      {files.map((f, idx) => (
                        <div key={idx} className="selected-file-item" style={{display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(0,0,0,0.05)', padding: '0.5rem', borderRadius: '8px', marginBottom: '0.5rem', justifyContent: 'space-between'}}>
                           <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                             {getFileIcon(f)}
                             <div style={{textAlign: 'left'}}>
                               <p style={{margin:0, fontSize: '0.9rem'}}>{f.name}</p>
                               <span className="file-meta" style={{margin:0}}>{(f.size / 1024 / 1024).toFixed(2)} MB</span>
                             </div>
                           </div>
                           <button 
                             type="button" 
                             style={{background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '0.5rem'}}
                             onClick={(e) => {
                               e.stopPropagation();
                               setFiles(files.filter((_, i) => i !== idx));
                             }}
                           >
                             ✕
                           </button>
                        </div>
                      ))}
                      <p style={{marginTop: '1rem', fontSize: '0.8rem', opacity: 0.7}}>Click to add more files to this bundle</p>
                    </div>
                  ) : (
                    <div>
                      <Upload size={40} className="icon-primary" />
                      <p>Click to browse files</p>
                      <span className="file-meta">
                        Images, Video, Audio, Documents, ZIPs, Design Files & More
                      </span>
                    </div>
                  )}
                </div>
                
                <div className="input-group">
                  <label>Project Title</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Creative Brand Identity" 
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                <div className="input-group">
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem'}}>
                    <label style={{margin: 0}}>{isPWYW ? 'Minimum Price (KSh)' : 'Price (KSh)'}</label>
                    <label style={{display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', opacity: 0.8, color: 'var(--foreground)', margin: 0}}>
                      <input 
                        type="checkbox" 
                        checked={isPWYW} 
                        onChange={(e) => setIsPWYW(e.target.checked)} 
                        style={{width: 'auto', margin: 0}}
                      />
                      Pay What You Want
                    </label>
                  </div>
                  <input 
                    type="number" 
                    placeholder={isPWYW ? "0 (Free) or minimum amount" : "0"} 
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                  />
                  {price && parseFloat(price) > 0 && (
                    <div className="commission-preview">
                      <div className="commission-row">
                        <span>Platform Commission (3.5%)</span>
                        <span>- KSh {calculateCommission(parseFloat(price), userPlan).platformFee.toLocaleString()}</span>
                      </div>
                      <div className="commission-row">
                        <span>Payment Gateway (1.5%)</span>
                        <span>- KSh {calculateCommission(parseFloat(price), userPlan).paymentGatewayFee.toLocaleString()}</span>
                      </div>
                      <div className="commission-row">
                        <span>M-Pesa Withdrawal Fee</span>
                        <span>- KSh {calculateCommission(parseFloat(price), userPlan).transferFee.toLocaleString()}</span>
                      </div>
                      <div className="commission-row earnings">
                        <span>You will receive (Net)</span>
                        <span>KSh {calculateCommission(parseFloat(price), userPlan).creatorEarnings.toLocaleString()}</span>
                      </div>
                      <p style={{ fontSize: '0.75rem', opacity: 0.5, marginTop: '0.8rem', fontStyle: 'italic' }}>
                        *Withdrawal fee is based on standard tiered rates.
                      </p>
                    </div>
                  )}
                </div>

                {isProcessing && (
                  <div className="progress-container">
                    <div className="progress-bar" style={{ width: `${uploadProgress}%` }}></div>
                    <span className="progress-text">
                      {uploadProgress < 70 ? 'Uploading & compressing...' : 
                       uploadProgress < 100 ? 'Saving project...' : 'Done!'}
                      {' '}{uploadProgress}%
                    </span>
                  </div>
                )}

                <div className="modal-actions">
                  <button className="btn-secondary" onClick={resetModal} disabled={isProcessing}>Cancel</button>
                  <button 
                    className="btn-primary" 
                    onClick={() => {
                      console.log('Button clicked');
                      handleUpload();
                    }} 
                    disabled={isProcessing || files.length === 0 || !title || !price}
                    style={{ opacity: (isProcessing || files.length === 0 || !title || !price) ? 0.5 : 1 }}
                  >
                    {isProcessing ? <><Loader2 className="spin" size={18} /> Processing...</> : 'Create Link'}
                  </button>
                </div>
              </>
            ) : (
              <div className="success-state">
                <CheckCircle2 size={48} className="icon-success" />
                <p className="success-subtitle">Preview auto-generated with watermark</p>
                <div className="link-box">
                  <LinkIcon size={20} />
                  <input type="text" readOnly value={generatedLink} />
                  <button className="btn-primary" onClick={() => {
                    navigator.clipboard.writeText(generatedLink);
                  }}>Copy</button>
                </div>
                <p className="success-help">Share this link with your client. They will see a compressed, watermarked preview and pay to unlock the full file.</p>
                <div className="modal-actions">
                  <button className="btn-primary" onClick={resetModal}>Done</button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}

      {isWithdrawing && (
        <div className="modal-overlay">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="upload-modal glass-card">
            <h3>Request Withdrawal</h3>
            <p style={{ opacity: 0.6, fontSize: '0.9rem', marginBottom: '1.5rem' }}>Withdraw your earnings directly to M-Pesa.</p>

            <form onSubmit={handleWithdrawalRequest}>
              <div className="input-group">
                <label>Amount to Withdraw (KSh)</label>
                <input 
                  type="number" 
                  placeholder="Min KSh 200" 
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  required
                />
                <small style={{ opacity: 0.4 }}>Available for withdrawal: KSh {(totalEarned - totalWithdrawn).toLocaleString()}</small>
              </div>

              <div className="input-group">
                <label>M-Pesa Number</label>
                <input 
                  type="tel" 
                  placeholder="254..." 
                  value={withdrawPhone}
                  onChange={(e) => setWithdrawPhone(e.target.value)}
                  required
                />
              </div>

              {withdrawalMessage && (
                <div className={`upload-error ${withdrawalMessage.type === 'success' ? 'success' : ''}`} style={{ background: withdrawalMessage.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : '', color: withdrawalMessage.type === 'success' ? '#10b981' : '', borderColor: withdrawalMessage.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : '' }}>
                  {withdrawalMessage.text}
                </div>
              )}

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => { setIsWithdrawing(false); setWithdrawalMessage(null); }}>Close</button>
                <button type="submit" className="btn-primary" disabled={isProcessing || !withdrawAmount}>
                  {isProcessing ? 'Processing...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {(isDiscounting || discountProject) && (
        <div className="modal-overlay">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="upload-modal glass-card">
            <h3>Create Discount Code</h3>
            <p style={{ opacity: 0.6, fontSize: '0.9rem', marginBottom: '1.5rem' }}>For project: <strong>{discountProject?.title}</strong></p>

            <form onSubmit={handleCreateDiscount}>
              <div className="input-group">
                <label>Discount Code (e.g. SUMMER20)</label>
                <input 
                  type="text" 
                  placeholder="Code" 
                  value={discountCode}
                  onChange={(e) => setDiscountCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
                  required
                />
              </div>

              <div className="input-group">
                <label>Discount Type</label>
                <select 
                  value={discountType} 
                  onChange={(e) => setDiscountType(e.target.value)}
                  style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: '1px solid var(--card-border)', marginBottom: '1.5rem' }}
                >
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed Amount (KSh)</option>
                </select>
              </div>

              <div className="input-group">
                <label>Discount Value</label>
                <input 
                  type="number" 
                  placeholder={discountType === 'percentage' ? "e.g. 20" : "e.g. 500"} 
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  min="1"
                  max={discountType === 'percentage' ? "100" : undefined}
                  required
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => { setDiscountProject(null); setIsDiscounting(false); }}>Close</button>
                <button type="submit" className="btn-primary" disabled={isProcessing || !discountCode || !discountValue}>
                  {isProcessing ? 'Saving...' : 'Create Code'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {isEditingProfile && (
        <div className="modal-overlay">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="upload-modal glass-card">
            <h3>Storefront Settings</h3>
            <p style={{ opacity: 0.6, fontSize: '0.9rem', marginBottom: '1.5rem' }}>Customize how your public portfolio looks.</p>

            <form onSubmit={handleSaveProfile}>
              <div className="input-group">
                <label>Bio</label>
                <textarea 
                  rows="3"
                  placeholder="Tell your audience about yourself..." 
                  value={profileData.bio}
                  onChange={(e) => setProfileData({...profileData, bio: e.target.value})}
                  style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: '1px solid var(--card-border)', background: '#F8FAFC' }}
                />
              </div>

              <div className="input-group">
                <label>Cover Photo URL</label>
                <input 
                  type="url" 
                  placeholder="https://..." 
                  value={profileData.coverPhotoUrl}
                  onChange={(e) => setProfileData({...profileData, coverPhotoUrl: e.target.value})}
                />
              </div>

              <div className="input-group">
                <label>Website URL</label>
                <input 
                  type="url" 
                  placeholder="https://..." 
                  value={profileData.website}
                  onChange={(e) => setProfileData({...profileData, website: e.target.value})}
                />
              </div>

              <div className="input-group">
                <label>Twitter/X Profile URL</label>
                <input 
                  type="url" 
                  placeholder="https://x.com/..." 
                  value={profileData.twitter}
                  onChange={(e) => setProfileData({...profileData, twitter: e.target.value})}
                />
              </div>

              <div className="input-group">
                <label>Instagram Profile URL</label>
                <input 
                  type="url" 
                  placeholder="https://instagram.com/..." 
                  value={profileData.instagram}
                  onChange={(e) => setProfileData({...profileData, instagram: e.target.value})}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setIsEditingProfile(false)}>Close</button>
                <button type="submit" className="btn-primary" disabled={isProcessing}>
                  {isProcessing ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      <style jsx>{`
        .dashboard-container {
          padding: 2rem 4rem;
          max-width: 1400px;
          margin: 0 auto;
        }

        .dash-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 3rem;
        }

        .header-title {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 1.5rem;
        }

        .upload-counter {
          background: #F8FAFC;
          border: 1px solid var(--card-border);
          padding: 0.5rem 1rem;
          border-radius: 8px;
          font-size: 0.85rem;
          font-weight: 600;
        }

        .upload-counter .limit-reached {
          color: #EF4444;
        }

        .home-icon {
          opacity: 0.5;
          transition: opacity 0.3s;
          cursor: pointer;
        }

        .home-icon:hover {
          opacity: 1;
          color: var(--primary);
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 2rem;
          margin-bottom: 4rem;
        }

        .stat-card-wrapper {
          position: relative;
          display: flex;
          flex-direction: column;
        }

        .btn-withdraw {
          position: absolute;
          top: 1rem;
          right: 1rem;
          background: var(--primary);
          color: white;
          border: none;
          padding: 0.4rem 0.8rem;
          border-radius: 8px;
          font-size: 0.8rem;
          font-weight: 700;
          cursor: pointer;
          transition: 0.3s;
        }

        .btn-withdraw:hover {
          transform: translateY(-2px);
          filter: brightness(1.1);
        }

        .projects-section h2 {
          margin-bottom: 2rem;
          font-size: 1.8rem;
        }

        .pending-notice {
          background: rgba(245, 158, 11, 0.05);
          border: 1px solid rgba(245, 158, 11, 0.2);
          color: #D97706;
          padding: 1rem 1.5rem;
          border-radius: 12px;
          display: flex;
          align-items: center;
          gap: 0.8rem;
          margin-bottom: 3rem;
          font-size: 0.95rem;
        }

        .projects-grid {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .payouts-list {
          padding: 0;
          overflow: hidden;
          margin-top: 1rem;
        }

        .payout-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }

        .payout-table th {
          padding: 1.2rem;
          opacity: 0.5;
          font-size: 0.85rem;
          border-bottom: 1px solid rgba(0,0,0,0.05);
        }

        .payout-table td {
          padding: 1.2rem;
          border-bottom: 1px solid rgba(0,0,0,0.02);
          font-size: 0.95rem;
        }

        .status-pill {
          padding: 0.3rem 0.6rem;
          border-radius: 6px;
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
        }

        .status-pill.completed { background: #DCFCE7; color: #166534; }
        .status-pill.pending { background: #FEF3C7; color: #92400E; }
        .status-pill.rejected { background: #FEE2E2; color: #991B1B; }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0,0,0,0.8);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .upload-modal {
          width: 500px;
          padding: 2.5rem;
        }

        .empty-state {
          text-align: center;
          padding: 4rem;
          background: rgba(255,255,255,0.02);
          border-radius: 20px;
          border: 1px dashed var(--glass-border);
          opacity: 0.5;
        }

        .upload-error {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: rgba(248, 113, 113, 0.1);
          border: 1px solid rgba(248, 113, 113, 0.3);
          color: #f87171;
          padding: 0.8rem 1rem;
          border-radius: 10px;
          margin: 1rem 0;
          font-size: 0.9rem;
        }

        .upload-dropzone {
          border: 2px dashed var(--glass-border);
          border-radius: 16px;
          padding: 3rem;
          text-align: center;
          margin: 1.5rem 0;
          cursor: pointer;
          transition: all 0.3s;
        }

        .upload-dropzone:hover {
          border-color: var(--primary);
          background: var(--primary-glow);
        }

        .file-meta {
          font-size: 0.8rem;
          opacity: 0.5;
          display: block;
          margin-top: 0.3rem;
        }

        .input-group {
          margin-bottom: 1.5rem;
        }

        .input-group label {
          display: block;
          margin-bottom: 0.5rem;
          font-size: 0.9rem;
          opacity: 0.7;
          color: var(--foreground);
        }

        .input-group input {
          width: 100%;
          background: #F8FAFC;
          border: 1px solid var(--card-border);
          padding: 0.8rem;
          border-radius: 8px;
          color: var(--foreground);
        }

        .commission-preview {
          margin-top: 0.8rem;
          padding: 0.8rem;
          background: #F8FAFC;
          border-radius: 8px;
          border: 1px solid var(--card-border);
          font-size: 0.85rem;
        }

        .commission-row {
          display: flex;
          justify-content: space-between;
          opacity: 0.6;
          margin-bottom: 0.3rem;
        }

        .commission-row.earnings {
          opacity: 1;
          color: var(--primary);
          font-weight: 700;
          margin-top: 0.5rem;
          padding-top: 0.5rem;
          border-top: 1px solid var(--glass-border);
        }

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 1rem;
          margin-top: 2rem;
        }

        .progress-container {
          width: 100%;
          height: 6px;
          background: rgba(0,0,0,0.05);
          border-radius: 4px;
          margin: 1.5rem 0;
          position: relative;
          overflow: hidden;
        }

        .progress-bar {
          height: 100%;
          background: var(--primary);
          transition: width 0.3s ease;
        }

        .progress-text {
          font-size: 0.8rem;
          opacity: 0.7;
          display: block;
          margin-top: 0.5rem;
          text-align: right;
        }

        .spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          100% { transform: rotate(360deg); }
        }

        .spin-slow {
          animation: spin 3s linear infinite;
        }

        .success-state {
          text-align: center;
          padding: 1rem 0;
        }

        .icon-success {
          color: var(--primary);
          margin-bottom: 0.5rem;
        }

        .success-subtitle {
          font-size: 0.85rem;
          opacity: 0.6;
          margin-bottom: 1rem;
        }

        .link-box {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: var(--glass);
          padding: 0.5rem;
          border-radius: 8px;
          margin: 1.5rem 0;
          border: 1px solid var(--primary);
        }

        .link-box input {
          flex: 1;
          background: transparent;
          border: none;
          color: var(--primary);
          outline: none;
          padding: 0.5rem;
          font-family: monospace;
          font-weight: 600;
        }

        .auth-warning {
          font-size: 0.8rem;
          color: #ffc107;
          margin-right: auto;
          opacity: 0.8;
        }

        .success-help {
          font-size: 0.9rem;
          opacity: 0.7;
          line-height: 1.5;
        }
      `}</style>
    </div>
  );
}

function StatCard({ title, value, icon }) {
  return (
    <div className="glass-card stat-card">
      <div className="stat-icon">{icon}</div>
      <div className="stat-info">
        <span>{title}</span>
        <h3>{value}</h3>
      </div>
      <style jsx>{`
        .stat-card {
          display: flex;
          align-items: center;
          gap: 1.5rem;
          padding: 1.5rem;
        }
        .stat-icon {
          background: var(--primary-glow);
          color: var(--primary);
          padding: 1rem;
          border-radius: 12px;
        }
        .stat-info span {
          font-size: 0.9rem;
          opacity: 0.6;
        }
        .stat-info h3 {
          font-size: 1.8rem;
          font-weight: 800;
        }
      `}</style>
    </div>
  );
}

function ProjectRow({ id, title, price, status, date, resourceType, fileSize, views, sales, onAddDiscount }) {
  const getTypeIcon = () => {
    if (resourceType === 'video') return <Film size={18} />;
    if (resourceType === 'image') return <Image size={18} />;
    return <FileText size={18} />;
  };

  return (
    <div className="glass-card project-row">
      <div className="row-main">
        <div className="row-type">{getTypeIcon()}</div>
        <div>
          <h4>{title}</h4>
          <span>
            {date}
            {fileSize ? ` • ${(fileSize / 1024 / 1024).toFixed(1)}MB` : ''}
          </span>
        </div>
      </div>
      <div className="row-meta">
        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-end', fontSize: '0.8rem', opacity: 0.7, marginRight: '1rem'}}>
          <span>{views || 0} Views</span>
          <span>{sales || 0} Sales ({views ? (((sales || 0)/views)*100).toFixed(1) : 0}%)</span>
        </div>
        <div className="row-price">{price}</div>
        <div className={`status-badge ${status.toLowerCase()}`}>{status}</div>
        <button className="btn-icon" onClick={() => onAddDiscount({id, title})} title="Add Discount"><Tag size={18} /></button>
        <button className="btn-icon" onClick={() => {
          if (id) navigator.clipboard.writeText(`${window.location.origin}/p/${id}`);
        }}><Share2 size={18} /></button>
      </div>
      <style jsx>{`
        .project-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.2rem 2rem;
        }
        .row-main {
          display: flex;
          align-items: center;
          gap: 1rem;
        }
        .row-type {
          background: var(--primary-glow);
          color: var(--primary);
          padding: 0.5rem;
          border-radius: 8px;
        }
        .row-main h4 {
          font-size: 1.1rem;
          margin-bottom: 0.2rem;
        }
        .row-main span {
          font-size: 0.85rem;
          opacity: 0.5;
        }
        .row-meta {
          display: flex;
          align-items: center;
          gap: 2rem;
        }
        .row-price {
          font-weight: 700;
        }
        .status-badge {
          padding: 0.4rem 0.8rem;
          border-radius: 6px;
          font-size: 0.8rem;
          font-weight: 600;
        }
        .status-badge.paid {
          background: rgba(39, 245, 187, 0.2);
          color: var(--primary);
        }
        .status-badge.pending {
          background: rgba(255, 193, 7, 0.2);
          color: #ffc107;
        }
        .status-badge.completed {
          background: rgba(39, 245, 187, 0.2);
          color: var(--primary);
        }
        .btn-icon {
          background: transparent;
          border: none;
          color: var(--foreground);
          cursor: pointer;
          opacity: 0.5;
          transition: opacity 0.3s;
        }
        .btn-icon:hover {
          opacity: 1;
          color: var(--primary);
        }
        @media (max-width: 1024px) {
          .dashboard-container { padding: 1.5rem 2rem; }
          .stats-grid { gap: 1rem; }
        }

        @media (max-width: 768px) {
          .dashboard-container { padding: 1rem; }
          .dash-header { 
            flex-direction: column; 
            align-items: stretch; 
            gap: 1rem; 
            text-align: center;
          }
          .header-left { justify-content: center; }
          .header-right { 
            width: 100%; 
            flex-direction: column-reverse;
            gap: 1rem;
          }
          .upload-counter { width: 100%; text-align: center; }
          .btn-primary { width: 100%; justify-content: center; }
          
          .stats-grid { grid-template-columns: 1fr; }
          .stat-card-wrapper { width: 100%; }
          
          .row-meta { 
            width: 100%; 
            justify-content: space-between; 
            margin-top: 1rem;
            padding-top: 1rem;
            border-top: 1px solid rgba(0,0,0,0.05);
          }
          
          .project-row { 
            flex-direction: column; 
            align-items: flex-start; 
            padding: 1.2rem;
          }

          .upload-modal {
            width: 95%;
            padding: 1.5rem;
            max-height: 90vh;
            overflow-y: auto;
          }
        }
      `}</style>
    </div>
  );
}
