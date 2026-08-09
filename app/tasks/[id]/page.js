'use client';

import { useState, useEffect, useRef } from 'react';
import { db, auth } from '../../../lib/firebase';
import { doc, getDoc, collection, addDoc, query, where, getDocs, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { ArrowLeft, Loader2, Calendar, User, DollarSign, Upload, AlertCircle, CheckCircle2, ChevronRight, MessageSquare, ExternalLink, Link as LinkIcon, FileText, Image, Film, Music, Archive, Flag } from 'lucide-react';
import Link from 'next/link';
import { validateUpload } from '../../../lib/uploadConfig';
import { calculateCommission } from '../../../lib/commission';
import { motion, AnimatePresence } from 'framer-motion';

// Level definitions: each level allows up to a budget limit
const LEVEL_ACCESS = [
  { level: 1, label: 'New Talent',  maxBudget: 5000,    badge: '🌱', color: '#64748b' },
  { level: 2, label: 'Rising Star', maxBudget: 20000,   badge: '⭐', color: '#f59e0b' },
  { level: 3, label: 'Pro',         maxBudget: 100000,  badge: '🚀', color: '#3b82f6' },
  { level: 4, label: 'Elite',       maxBudget: Infinity, badge: '💎', color: '#10b981' },
];

function getRequiredLevel(budget) {
  return LEVEL_ACCESS.find(l => budget <= l.maxBudget) || LEVEL_ACCESS[LEVEL_ACCESS.length - 1];
}

function getCreatorLevel(userData) {
  return LEVEL_ACCESS.find(l => l.level === (userData?.creatorLevel || 1)) || LEVEL_ACCESS[0];
}

const MOCK_TASKS = {
  mock_task_1: {
    id: 'mock_task_1',
    title: 'Minimalist Tech Logo Design',
    category: 'Graphic Design',
    description: 'We need a modern, sleek logo for a new fintech startup based in Nairobi. The brand name is "FinFlow". Deliverables should include vector formats (AI, EPS) and high-res PNG/JPG previews.',
    budget: 3500,
    clientName: 'Nairobi Fintech Ltd',
    clientUid: 'mock_client_1',
    clientEmail: 'info@finflow.co.ke',
    deadline: '2026-08-25',
    submissionsCount: 2,
    createdAt: '2026-08-08T10:00:00Z'
  },
  mock_task_2: {
    id: 'mock_task_2',
    title: 'Next.js Landing Page Development',
    category: 'Web & UI/UX Design',
    description: 'Looking for a developer to convert our Figma design into a responsive Next.js landing page. Clean code, fast performance, and mobile responsive are key. We will host on Vercel.',
    budget: 15000,
    clientName: 'Keja Rentals',
    clientUid: 'mock_client_2',
    clientEmail: 'tech@kejarentals.co.ke',
    deadline: '2026-09-02',
    submissionsCount: 1,
    createdAt: '2026-08-08T09:00:00Z'
  },
  mock_task_3: {
    id: 'mock_task_3',
    title: '3D Render of modern 4-Bedroom Villa',
    category: 'Architecture & 3D',
    description: 'Need interior and exterior 3D photorealistic renderings for a modern residential villa in Runda. Architectural drawings/floorplans will be provided.',
    budget: 25000,
    clientName: 'Alpha Developers',
    clientUid: 'mock_client_3',
    clientEmail: 'info@alphadevelopers.co.ke',
    deadline: '2026-08-30',
    submissionsCount: 0,
    createdAt: '2026-08-07T12:00:00Z'
  }
};

const MOCK_SUBMISSIONS = [
  {
    id: 'sub_1',
    taskId: 'mock_task_1',
    creatorName: 'David Mwangi',
    creatorEmail: 'david@mwangi.com',
    description: 'Here is my concept. Focused on flow and connectivity for fintech branding. Designed in black, white, and electric blue.',
    projectId: 'demo',
    projectTitle: 'FinFlow Logo - david_concept.png',
    projectPrice: 3500,
    createdAt: '2026-08-08T12:00:00Z',
    status: 'pending',
    previewUrl: 'https://images.unsplash.com/photo-1626785774573-4b799315345d?q=80&w=300&auto=format&fit=crop'
  },
  {
    id: 'sub_2',
    taskId: 'mock_task_1',
    creatorName: 'Sarah Wambui',
    creatorEmail: 'sarah@wambui.com',
    description: 'Modern minimalist abstract concept featuring dual intersecting arrows to represent seamless cashflow.',
    projectId: 'demo',
    projectTitle: 'FinFlow Logo - Sarah_Design.png',
    projectPrice: 3500,
    createdAt: '2026-08-08T13:00:00Z',
    status: 'pending',
    previewUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=300&auto=format&fit=crop'
  }
];

export default function TaskDetailPage({ params }) {
  const { id } = params;
  const fileInputRef = useRef(null);

  const [task, setTask] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);

  // Submission Form State
  const [proposalMsg, setProposalMsg] = useState('');
  const [files, setFiles] = useState([]);
  const [customPrice, setCustomPrice] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Report Modal State
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState('Scam / Fraud');
  const [reportDesc, setReportDesc] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  // Q&A State
  const [qaMessages, setQaMessages] = useState([]);
  const [newQuestion, setNewQuestion] = useState('');
  const [isPostingQA, setIsPostingQA] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          setUserData(userDoc.data());
        }
      } else {
        setUserData(null);
        window.location.href = '/login';
      }
    });
    return () => unsubscribe();
  }, []);

  const loadTaskAndSubmissions = async () => {
    try {
      setLoading(true);
      if (id.startsWith('mock_task_')) {
        const mockTask = MOCK_TASKS[id];
        setTask(mockTask);
        if (mockTask) {
          const subs = MOCK_SUBMISSIONS.filter(s => s.taskId === id);
          setSubmissions(subs);
        }
      } else {
        const docRef = doc(db, 'tasks', id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const taskData = { id: docSnap.id, ...docSnap.data() };
          setTask(taskData);
          setCustomPrice(taskData.budget.toString());
          
          // Fetch submissions
          const qSub = query(collection(db, 'task_submissions'), where('taskId', '==', id));
          const snapshotSub = await getDocs(qSub);
          
          const subsList = await Promise.all(
            snapshotSub.docs.map(async (docSub) => {
              const data = docSub.data();
              let submissionData = { id: docSub.id, ...data };
              if (data.projectId) {
                try {
                  const projDoc = await getDoc(doc(db, 'projects', data.projectId));
                  if (projDoc.exists()) {
                    const proj = projDoc.data();
                    submissionData.previewUrl = proj.previewUrl || '';
                    submissionData.projectTitle = proj.title || proj.fileName;
                    submissionData.projectPrice = proj.price;
                    
                    const qTrans = query(
                      collection(db, 'transactions'),
                      where('projectId', '==', data.projectId),
                      where('status', '==', 'completed')
                    );
                    const snapTrans = await getDocs(qTrans);
                    if (!snapTrans.empty) {
                      submissionData.status = 'paid';
                      submissionData.transactionId = snapTrans.docs[0].id;
                    }
                  }
                } catch (e) {
                  console.error("Error loading sub project:", e);
                }
              }
              return submissionData;
            })
          );
          
          subsList.sort((a, b) => {
            const da = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
            const db = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
            return db - da;
          });
          setSubmissions(subsList);

          // Fetch Q&A messages
          fetch(`/api/messages?taskId=${id}&type=public_qa`)
            .then(res => res.json())
            .then(data => { if (data.success) setQaMessages(data.messages); })
            .catch(err => console.error("Error fetching QA messages:", err));
        } else {
          setTask(null);
        }
      }
    } catch (err) {
      console.error("Error loading task:", err);
    } finally {
      setLoading(false);
    }
  };



  useEffect(() => {
    loadTaskAndSubmissions();
  }, [id]);

  useEffect(() => {
    if (task && user && task.clientUid === user.uid && submissions.length > 0) {
      // Mark unviewed submissions as viewed
      const markViewed = async () => {
        for (const sub of submissions) {
          if (!sub.viewedAt) {
            try {
              await updateDoc(doc(db, 'task_submissions', sub.id), {
                viewedAt: serverTimestamp()
              });
              
              // Send notification to creator
              fetch('/api/notify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  recipientUid: sub.creatorUid,
                  type: 'submission_viewed',
                  title: 'Submission Viewed!',
                  message: `The client viewed your submission for "${task.title}".`,
                  link: `/dashboard`
                })
              }).catch(() => {});
            } catch (e) {
              console.error('Error marking viewed:', e);
            }
          }
        }
      };
      markViewed();
    }
  }, [task, user, submissions]);

  const handleShortlist = async (sub) => {
    try {
      await updateDoc(doc(db, 'task_submissions', sub.id), {
        status: 'shortlisted'
      });
      // Update local state
      setSubmissions(prev => prev.map(s => s.id === sub.id ? { ...s, status: 'shortlisted' } : s));
      
      // Notify creator
      fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientUid: sub.creatorUid,
          type: 'submission_shortlisted',
          title: 'You were shortlisted! ⭐',
          message: `The client shortlisted your submission for "${task.title}".`,
          link: `/dashboard`
        })
      }).catch(() => {});
      
      alert('Submission shortlisted!');
    } catch (e) {
      console.error(e);
      alert('Failed to shortlist submission.');
    }
  };

  const handleFileChange = (e) => {
    setUploadError('');
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files);
      for (const f of selectedFiles) {
        const validation = validateUpload(f, 'FREE');
        if (!validation.valid) {
          setUploadError(`Error with ${f.name}: ${validation.error}`);
          return;
        }
      }
      setFiles(prev => [...prev, ...selectedFiles]);
    }
  };

  const handleSubmission = async (e) => {
    e.preventDefault();
    if (!user) {
      window.location.href = '/login';
      return;
    }

    if (id.startsWith('mock_task_')) {
      // Demo logic
      setIsUploading(true);
      setUploadProgress(20);
      setTimeout(() => setUploadProgress(60), 500);
      setTimeout(() => {
        setUploadProgress(100);
        setIsUploading(false);
        setSuccessMsg('Demo Proposal submitted successfully!');
        setProposalMsg('');
        setFiles([]);
      }, 1000);
      return;
    }

    if (files.length === 0) {
      alert("Please upload at least one final deliverable file.");
      return;
    }

    setIsUploading(true);
    setUploadProgress(10);
    setUploadError('');

    try {
      // 1. Sign Cloudinary upload
      const signRes = await fetch('/api/upload/sign', { method: 'POST' });
      if (!signRes.ok) throw new Error("Failed to sign uploads.");
      const { signature, timestamp, apiKey, cloudName, folder } = await signRes.json();

      let uploadedFilesData = [];

      // 2. Upload to Cloudinary
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const mimeType = file.type || '';
        const isVideo = mimeType.startsWith('video/');
        const isAudio = mimeType.startsWith('audio/');
        const isImage = mimeType.startsWith('image/');
        const resourceType = (isVideo || isAudio) ? 'video' : isImage ? 'image' : 'raw';

        const formData = new FormData();
        formData.append('file', file);
        formData.append('api_key', apiKey);
        formData.append('timestamp', timestamp);
        formData.append('signature', signature);
        formData.append('folder', folder);

        setUploadProgress(10 + Math.floor((i / files.length) * 60));

        const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, {
          method: 'POST',
          body: formData,
        });

        if (!uploadRes.ok) {
          const errData = await uploadRes.json();
          throw new Error(errData.error?.message || `Direct upload failed for ${file.name}`);
        }

        const cloudData = await uploadRes.json();

        // 3. Generate preview watermark for images/videos/audio
        let previewUrl = '';
        if (isImage || isVideo || isAudio) {
          const previewRes = await fetch('/api/upload/preview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              publicId: cloudData.public_id,
              resourceType: isAudio ? 'audio' : cloudData.resource_type,
              creatorName: userData?.name || 'Creator',
            }),
          });
          if (previewRes.ok) {
            const previewData = await previewRes.json();
            previewUrl = previewData.previewUrl;
          }
        }

        uploadedFilesData.push({
          originalUrl: cloudData.secure_url || '',
          originalPublicId: cloudData.public_id || '',
          previewUrl: previewUrl || '',
          resourceType: isAudio ? 'audio' : cloudData.resource_type || 'raw',
          format: cloudData.format || 'unknown',
          fileSize: cloudData.bytes || 0,
          fileName: file.name || 'file'
        });
      }

      setUploadProgress(80);

      // 4. Create standard Lipapata project for this submission
      const mainFile = uploadedFilesData[0] || {};
      const projRef = await addDoc(collection(db, 'projects'), {
        uid: user.uid,
        title: `Deliverable for: ${task.title}`,
        price: parseFloat(customPrice) || task.budget,
        files: uploadedFilesData,
        originalUrl: mainFile.originalUrl || '',
        originalPublicId: mainFile.originalPublicId || '',
        previewUrl: mainFile.previewUrl || '',
        resourceType: mainFile.resourceType || 'raw',
        format: mainFile.format || 'unknown',
        fileSize: mainFile.fileSize || 0,
        fileName: mainFile.fileName || 'file',
        createdAt: serverTimestamp(),
        status: 'Pending',
        isPWYW: false,
        expiresAfterDelivery: false,
      });

      setUploadProgress(90);

      // 5. Create task submission
      await addDoc(collection(db, 'task_submissions'), {
        taskId: task.id,
        creatorUid: user.uid,
        creatorName: userData?.name || user.displayName || user.email.split('@')[0],
        creatorEmail: user.email,
        description: proposalMsg,
        projectId: projRef.id,
        status: 'pending',
        createdAt: serverTimestamp()
      });

      // 6. Increment submissions count on task brief
      await updateDoc(doc(db, 'tasks', task.id), {
        submissionsCount: increment(1)
      });

      setUploadProgress(100);
      setSuccessMsg('Your proposal and deliverable were submitted successfully!');
      setProposalMsg('');
      setFiles([]);
      loadTaskAndSubmissions();
    } catch (err) {
      console.error(err);
      setUploadError(err.message || 'Submission failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleReportTask = async (e) => {
    e.preventDefault();
    if (!user) {
      window.location.href = '/login';
      return;
    }
    setIsSubmittingReport(true);
    try {
      await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportedType: 'task',
          reportedId: task.id,
          reportedUid: task.clientUid,
          reporterUid: user.uid,
          reason: reportReason,
          description: reportDesc
        })
      });
      setIsReportModalOpen(false);
      setReportDesc('');
      alert('Report submitted to moderation team. Thank you!');
    } catch (e) {
      console.error(e);
      alert('Failed to submit report.');
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const handlePostQA = async (e) => {
    e.preventDefault();
    if (!user) {
      window.location.href = '/login';
      return;
    }
    if (!newQuestion.trim()) return;

    setIsPostingQA(true);
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: task.id,
          type: 'public_qa',
          senderUid: user.uid,
          senderName: userData?.name || user.displayName || user.email.split('@')[0],
          content: newQuestion.trim()
        })
      });
      const data = await res.json();
      if (data.success) {
        setQaMessages(prev => [...prev, {
          id: data.messageId,
          taskId: task.id,
          type: 'public_qa',
          senderUid: user.uid,
          senderName: userData?.name || user.displayName || user.email.split('@')[0],
          content: newQuestion.trim(),
          createdAt: new Date().toISOString()
        }]);
        setNewQuestion('');

        // Notify client if creator asked
        if (user.uid !== task.clientUid) {
          fetch('/api/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recipientUid: task.clientUid,
              type: 'qa_asked',
              title: 'New Question on Brief 💬',
              message: `${userData?.name || 'A creator'} asked a question on "${task.title}".`,
              link: `/tasks/${task.id}`
            })
          }).catch(() => {});
        }
      }
    } catch (err) {
      console.error("Error posting QA:", err);
    } finally {
      setIsPostingQA(false);
    }
  };

  const getFileIcon = (f) => {
    if (!f) return <Upload size={32} className="icon-primary" />;
    const mime = f.type || '';
    const name = f.name || '';
    if (mime.startsWith('image/')) return <Image size={32} className="icon-primary" />;
    if (mime.startsWith('video/')) return <Film size={32} className="icon-primary" />;
    if (mime.startsWith('audio/')) return <Music size={32} className="icon-primary" />;
    if (name.endsWith('.zip') || mime.includes('zip') || mime.includes('archive')) return <Archive size={32} className="icon-primary" />;
    return <FileText size={32} className="icon-primary" />;
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <Loader2 className="spin" size={40} />
        <p>Loading brief details...</p>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="not-found-screen">
        <AlertCircle size={48} color="#EF4444" />
        <h2>Brief Not Found</h2>
        <p>This task brief may have been deleted, closed, or does not exist.</p>
        <Link href="/tasks">
          <button className="btn-primary" style={{ marginTop: '1.5rem' }}>
            <ArrowLeft size={16} /> Back to Marketplace
          </button>
        </Link>
      </div>
    );
  }

  const isClient = task.clientUid === user?.uid;
  const displaySubmissions = submissions;

  return (
    <div className="task-detail-container">
      {/* Navigation */}
      <nav className="nav">
        <Link href="/" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="logo-container" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <img src="/logo-v2.png" alt="Lipapata Logo" style={{ width: '80px', height: '80px', objectFit: 'contain', mixBlendMode: 'darken' }} />
            <div className="logo">Lipapata<span>.</span></div>
          </div>
        </Link>
        <div className="nav-links">
          <Link href="/">Home</Link>
          <Link href="/tasks" style={{ color: 'var(--primary)', fontWeight: 800 }}>Browse Tasks</Link>
          {user ? (
            <Link href="/dashboard" className="login-link">Dashboard</Link>
          ) : (
            <Link href="/login" className="login-link">Login</Link>
          )}
        </div>
      </nav>

      {/* Back button & Report */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '1rem 0' }}>
        <Link href="/tasks" className="back-link" style={{ margin: 0 }}>
          <ArrowLeft size={16} /> Back to marketplace
        </Link>
        <button 
          onClick={() => setIsReportModalOpen(true)}
          style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <Flag size={14} /> Report Brief
        </button>
      </div>

      <div className="task-layout">
        {/* Left Side: Task Brief Details */}
        <section className="task-brief-col glass-card">
          <span className="task-category-badge">{task.category}</span>
          <h1>{task.title}</h1>
          
          <div className="task-metadata-grid">
            <div className="meta-card">
              <span className="meta-label">Client</span>
              <div className="meta-value-row">
                <User size={16} />
                <span>{task.clientName}</span>
              </div>
            </div>
            <div className="meta-card">
              <span className="meta-label">Escrow Budget</span>
              <div className="meta-value-row budget">
                <DollarSign size={16} />
                <span>KSh {parseFloat(task.budget).toLocaleString()}</span>
              </div>
            </div>
            <div className="meta-card">
              <span className="meta-label">Deadline</span>
              <div className="meta-value-row">
                <Calendar size={16} />
                <span>{task.deadline}</span>
              </div>
            </div>
          </div>

          <div className="description-content">
            <h3>Brief Description &amp; Specifications</h3>
            <p>{task.description}</p>
          </div>

          {task.referenceFiles && task.referenceFiles.length > 0 && (
            <div className="reference-files-section" style={{ marginTop: '2rem', padding: '1.5rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: '#334155' }}>Reference Materials</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {task.referenceFiles.map((file, i) => (
                  <a key={i} href={file.url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem 1rem', background: 'white', border: '1px solid #cbd5e1', borderRadius: '8px', textDecoration: 'none', color: 'inherit' }}>
                    <div style={{ width: '40px', height: '40px', background: '#f1f5f9', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FileText size={20} color="#3b82f6" />
                    </div>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <p style={{ margin: 0, fontWeight: 500, fontSize: '0.9rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{file.name}</p>
                    </div>
                    <ExternalLink size={16} color="#64748b" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Public Q&A Thread */}
          <div className="qa-section" style={{ marginTop: '2rem', padding: '1.5rem', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MessageSquare size={18} color="#3b82f6" /> Brief Clarification Q&amp;A
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem', maxHeight: '250px', overflowY: 'auto' }}>
              {qaMessages.length > 0 ? (
                qaMessages.map(m => (
                  <div key={m.id} style={{ padding: '0.75rem 1rem', borderRadius: '8px', background: m.senderUid === task.clientUid ? '#eff6ff' : '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.85rem', color: m.senderUid === task.clientUid ? '#2563eb' : '#334155' }}>
                        {m.senderName} {m.senderUid === task.clientUid && '(Client)'}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#1e293b' }}>{m.content}</p>
                  </div>
                ))
              ) : (
                <p style={{ color: '#94a3b8', fontSize: '0.85rem', fontStyle: 'italic', margin: 0 }}>No questions asked yet. Have a question about this brief? Ask below!</p>
              )}
            </div>

            <form onSubmit={handlePostQA} style={{ display: 'flex', gap: '0.5rem' }}>
              <input 
                type="text" 
                placeholder="Ask client a public question..." 
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                style={{ flex: 1, padding: '0.7rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                required
              />
              <button type="submit" className="btn-primary" disabled={isPostingQA || !newQuestion.trim()}>
                {isPostingQA ? 'Sending...' : 'Ask'}
              </button>
            </form>
          </div>
        </section>

        {/* Right Side: Client View (submissions list) OR Creator View (apply form) */}
        <section className="task-action-col">
          {isClient ? (
            <div className="glass-card full-height">
              <h2>Creator Deliverables ({displaySubmissions.length})</h2>
              <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '2rem' }}>
                Review proposals and preview watermarked files. Click "Unlock Deliverable" to release the budget.
              </p>

              {displaySubmissions.length > 0 ? (
                <div className="submissions-list">
                  {displaySubmissions.map((sub) => (
                    <div key={sub.id} className="submission-card">
                      <div className="submission-header">
                        <h4>{sub.creatorName}</h4>
                        <span className={`status-tag ${sub.status}`}>
                          {sub.status === 'paid' ? 'Paid & Unlocked' : sub.status === 'shortlisted' ? '⭐ Shortlisted' : 'Pending Review'}
                        </span>
                      </div>
                      
                      <p className="submission-proposal">{sub.description}</p>
                      
                      {sub.previewUrl && (
                        <div className="submission-preview-box">
                          <img src={sub.previewUrl} alt="Deliverable Preview" />
                          <div className="preview-watermark">PREVIEW ONLY</div>
                        </div>
                      )}
                      
                      <div className="submission-project-info">
                        <FileText size={16} />
                        <span>{sub.projectTitle || 'Deliverable Bundle'}</span>
                        <span className="price-tag">KSh {parseFloat(sub.projectPrice || task.budget).toLocaleString()}</span>
                      </div>

                      <div className="submission-footer">
                        {sub.status === 'paid' ? (
                          <Link href={`/api/download/${sub.projectId}?t=${sub.transactionId}`} target="_blank">
                            <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                              Download Final Deliverables
                            </button>
                          </Link>
                        ) : (
                          <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                            {sub.status !== 'shortlisted' && (
                              <button className="btn-secondary" onClick={() => handleShortlist(sub)} style={{ flex: 1, justifyContent: 'center' }}>
                                ⭐ Shortlist
                              </button>
                            )}
                            <Link href={`/p/${sub.projectId}`} target="_blank" style={{ flex: 2 }}>
                              <button className="btn-pay-action" style={{ width: '100%' }}>
                                Preview &amp; Unlock <ChevronRight size={16} />
                              </button>
                            </Link>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-submissions">
                  <MessageSquare size={40} />
                  <h4>No submissions yet</h4>
                  <p>Creators will upload files here when they finish working on your brief.</p>
                </div>
              )}
            </div>
          ) : (
            // Creator View
            (() => {
              const creatorLevelInfo = getCreatorLevel(userData);
              const requiredLevelInfo = getRequiredLevel(task.budget);
              const hasAccess = !user || !userData || (userData.creatorLevel || 1) >= requiredLevelInfo.level;

              if (!hasAccess) {
                return (
                  <div className="glass-card level-lock-card">
                    <div className="level-lock-icon">{requiredLevelInfo.badge}</div>
                    <h2>🔒 Level Restricted Task</h2>
                    <p style={{ color: '#64748b', margin: '0.75rem 0 1.5rem' }}>
                      This brief has a budget of <strong>KSh {parseFloat(task.budget).toLocaleString()}</strong>, which requires <strong>{requiredLevelInfo.badge} Level {requiredLevelInfo.level} {requiredLevelInfo.label}</strong> or above to apply.
                    </p>
                    <div className="level-compare">
                      <div className="level-pill" style={{ background: `${creatorLevelInfo.color}22`, color: creatorLevelInfo.color }}>
                        {creatorLevelInfo.badge} Your Level: {creatorLevelInfo.label}
                      </div>
                      <div style={{ fontSize: '1.5rem' }}>→</div>
                      <div className="level-pill" style={{ background: `${requiredLevelInfo.color}22`, color: requiredLevelInfo.color }}>
                        {requiredLevelInfo.badge} Required: {requiredLevelInfo.label}
                      </div>
                    </div>
                    <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '1.5rem' }}>
                      Complete more gigs and earn great ratings to level up and access premium briefs!
                    </p>
                    <a href="/tasks" style={{ display: 'inline-block', marginTop: '1rem' }}>
                      <button className="btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>Browse Other Briefs</button>
                    </a>
                  </div>
                );
              }

              const maxSubmissions = task.maxSubmissions || 10;
              const isLimitReached = (task.submissionsCount || 0) >= maxSubmissions;

              if (isLimitReached) {
                return (
                  <div className="glass-card">
                    <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                      <div style={{ width: '60px', height: '60px', background: '#fee2e2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                        <AlertCircle size={30} color="#ef4444" />
                      </div>
                      <h2 style={{ marginBottom: '1rem' }}>Submission Limit Reached</h2>
                      <p style={{ color: '#64748b' }}>
                        This brief has reached its maximum limit of {maxSubmissions} submissions and is no longer accepting new proposals.
                      </p>
                      <a href="/tasks" style={{ display: 'inline-block', marginTop: '2rem' }}>
                        <button className="btn-primary">Browse Other Briefs</button>
                      </a>
                    </div>
                  </div>
                );
              }

              return (
            <div className="glass-card">
              <h2>Submit Your Deliverable</h2>
              <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '2rem' }}>
                Pitch your solution and upload files. We will auto-compress and watermark them for safe preview before payment.
              </p>

              {successMsg && (
                <div className="success-banner">
                  <CheckCircle2 size={20} />
                  <span>{successMsg}</span>
                </div>
              )}

              {uploadError && (
                <div className="error-banner">
                  <AlertCircle size={20} />
                  <span>{uploadError}</span>
                </div>
              )}

              {!successMsg && (
                <form onSubmit={handleSubmission}>
                  <div className="input-group">
                    <label>Proposal Message / Remarks</label>
                    <textarea 
                      rows={3}
                      placeholder="Hi, I completed the brand styling following your specs..." 
                      value={proposalMsg}
                      onChange={(e) => setProposalMsg(e.target.value)}
                      required
                    />
                  </div>

                  <div 
                    className="upload-dropzone"
                    onClick={() => fileInputRef.current.click()}
                  >
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileChange}
                      accept="image/*,video/*,audio/*,.pdf,.zip,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.psd,.ai,.fig,.ttf,.otf"
                      multiple
                      style={{ display: 'none' }}
                    />
                    
                    {files.length > 0 ? (
                      <div className="selected-files">
                        {files.map((file, idx) => (
                          <div key={idx} className="file-item">
                            {getFileIcon(file)}
                            <div className="file-details">
                              <p>{file.name}</p>
                              <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                            </div>
                            <button 
                              type="button" 
                              onClick={(e) => {
                                e.stopPropagation();
                                setFiles(files.filter((_, i) => i !== idx));
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="dropzone-inner">
                        <Upload size={32} className="icon-primary" />
                        <p>Click to browse final deliverable files</p>
                        <span>ZIPs, PDFs, Designs, Images, Video, Audio &amp; Fonts</span>
                      </div>
                    )}
                  </div>

                  <div className="input-group">
                    <label>Deliverable Price (KSh)</label>
                    <input 
                      type="number" 
                      value={customPrice}
                      onChange={(e) => setCustomPrice(e.target.value)}
                      placeholder={task.budget.toString()}
                      required
                    />
                    <small style={{ opacity: 0.5 }}>Defaults to task brief budget.</small>
                  </div>

                  {customPrice && parseFloat(customPrice) > 0 && (
                    <div className="net-earnings-card">
                      <div className="net-row">
                        <span>Platform Commission (3%)</span>
                        <span>- KSh {calculateCommission(parseFloat(customPrice), 'FREE').platformFee}</span>
                      </div>
                      <div className="net-row earnings">
                        <span>Your Net Pay</span>
                        <span>KSh {calculateCommission(parseFloat(customPrice), 'FREE').creatorEarnings}</span>
                      </div>
                    </div>
                  )}

                  {isUploading && (
                    <div className="progress-bar-container">
                      <div className="progress-fill" style={{ width: `${uploadProgress}%` }}></div>
                      <span className="progress-text">Uploading deliverable... {uploadProgress}%</span>
                    </div>
                  )}

                  <button 
                    type="submit" 
                    className="btn-primary" 
                    style={{ width: '100%', justifyContent: 'center', marginTop: '1.5rem' }}
                    disabled={isUploading || files.length === 0}
                  >
                    {isUploading ? 'Submitting Work...' : 'Submit Deliverable & Pitch'}
                  </button>
                </form>
              )}
            </div>
              );
            })()
          )}
        </section>
      </div>

      <style jsx>{`
        .task-detail-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 1.5rem 4rem;
        }

        .nav {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.6rem 1.5rem;
          margin: 1rem auto;
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-radius: 20px;
          border: 1px solid rgba(255, 255, 255, 0.3);
          position: sticky;
          top: 1rem;
          z-index: 100;
          box-shadow: 0 10px 30px rgba(0,0,0,0.05);
        }

        .nav-links {
          display: flex;
          gap: 2rem;
          align-items: center;
        }

        .nav-links a {
          color: #1e293b;
          text-decoration: none;
          font-weight: 600;
          transition: color 0.2s;
        }

        .nav-links a:hover {
          color: var(--primary);
        }

        .login-link {
          color: var(--primary) !important;
          font-weight: 800 !important;
        }

        .logo {
          font-size: 1.8rem;
          font-weight: 800;
          color: #000;
        }

        .logo span {
          color: var(--primary);
        }

        .back-link {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          color: #64748b;
          text-decoration: none;
          font-weight: 600;
          margin-bottom: 2rem;
          transition: color 0.2s;
        }

        .back-link:hover {
          color: var(--primary);
        }

        .task-layout {
          display: grid;
          grid-template-columns: 1.4fr 1.1fr;
          gap: 2rem;
          align-items: start;
        }

        .task-brief-col {
          padding: 2.5rem;
        }

        .task-category-badge {
          background: var(--primary-glow);
          color: var(--primary);
          padding: 0.3rem 0.8rem;
          border-radius: 100px;
          font-size: 0.8rem;
          font-weight: 700;
          display: inline-block;
          margin-bottom: 1rem;
        }

        .task-brief-col h1 {
          font-size: 2.5rem;
          font-weight: 900;
          margin-bottom: 1.5rem;
        }

        .task-metadata-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1rem;
          margin-bottom: 2.5rem;
        }

        .meta-card {
          background: #F8FAFC;
          border: 1px solid var(--card-border);
          border-radius: 12px;
          padding: 1rem;
        }

        .meta-label {
          display: block;
          font-size: 0.75rem;
          text-transform: uppercase;
          color: #94a3b8;
          font-weight: 700;
          margin-bottom: 0.3rem;
        }

        .meta-value-row {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-weight: 700;
          color: #334155;
          font-size: 0.95rem;
        }

        .meta-value-row.budget {
          color: var(--primary);
        }

        .description-content h3 {
          font-size: 1.25rem;
          font-weight: 800;
          margin-bottom: 1rem;
        }

        .description-content p {
          color: #475569;
          line-height: 1.7;
          font-size: 1rem;
          white-space: pre-line;
        }

        .task-action-col h2 {
          font-size: 1.5rem;
          font-weight: 800;
          margin-bottom: 0.5rem;
        }

        .submissions-list {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .submission-card {
          background: #F8FAFC;
          border: 1px solid var(--card-border);
          border-radius: 14px;
          padding: 1.5rem;
        }

        .submission-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.8rem;
        }

        .submission-header h4 {
          font-size: 1.05rem;
          font-weight: 800;
        }

        .status-tag {
          font-size: 0.75rem;
          font-weight: 700;
          padding: 0.2rem 0.6rem;
          border-radius: 6px;
        }

        .status-tag.pending {
          background: #FEF3C7;
          color: #92400E;
        }

        .status-tag.paid {
          background: #DCFCE7;
          color: #166534;
        }

        .level-lock-card {
          text-align: center;
          padding: 3rem 2rem;
        }

        .level-lock-icon {
          font-size: 4rem;
          margin-bottom: 1rem;
        }

        .level-compare {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 1rem;
          margin-top: 1.5rem;
          flex-wrap: wrap;
        }

        .level-pill {
          padding: 0.5rem 1.2rem;
          border-radius: 100px;
          font-weight: 700;
          font-size: 0.9rem;
        }

        .submission-proposal {
          font-size: 0.9rem;
          color: #475569;
          line-height: 1.5;
          margin-bottom: 1.2rem;
        }

        .submission-preview-box {
          position: relative;
          border-radius: 8px;
          overflow: hidden;
          background: #111;
          aspect-ratio: 16/10;
          margin-bottom: 1.2rem;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .submission-preview-box img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          opacity: 0.85;
        }

        .preview-watermark {
          position: absolute;
          font-weight: 900;
          font-size: 1.8rem;
          opacity: 0.15;
          transform: rotate(-30deg);
          color: white;
          pointer-events: none;
        }

        .submission-project-info {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.85rem;
          color: #64748b;
          background: white;
          padding: 0.6rem 0.8rem;
          border-radius: 8px;
          border: 1px solid var(--card-border);
          margin-bottom: 1.2rem;
        }

        .submission-project-info .price-tag {
          margin-left: auto;
          font-weight: 800;
          color: var(--primary);
        }

        .btn-pay-action {
          background: var(--primary);
          color: white;
          border: none;
          padding: 0.75rem 1rem;
          border-radius: 10px;
          font-weight: 700;
          width: 100%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          box-shadow: 0 4px 12px var(--primary-glow);
          transition: all 0.2s;
        }

        .btn-pay-action:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(34, 197, 94, 0.25);
        }

        .empty-submissions {
          text-align: center;
          padding: 4rem 1rem;
          color: #94a3b8;
        }

        .empty-submissions h4 {
          margin-top: 1rem;
          color: #475569;
        }

        /* Application Form styling */
        .success-banner {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: #DCFCE7;
          border: 1px solid rgba(22, 101, 52, 0.2);
          color: #166534;
          padding: 1rem;
          border-radius: 12px;
          margin-bottom: 2rem;
          font-weight: 600;
        }

        .error-banner {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: #FEE2E2;
          border: 1px solid rgba(153, 27, 27, 0.2);
          color: #991B1B;
          padding: 1rem;
          border-radius: 12px;
          margin-bottom: 2rem;
          font-weight: 600;
        }

        .input-group {
          margin-bottom: 1.5rem;
        }

        .input-group label {
          display: block;
          font-weight: 600;
          color: #475569;
          font-size: 0.88rem;
          margin-bottom: 0.5rem;
        }

        .input-group textarea, .input-group input {
          width: 100%;
          background: #F8FAFC;
          border: 1px solid var(--card-border);
          padding: 0.85rem;
          border-radius: 8px;
          font-family: inherit;
          outline: none;
          color: var(--foreground);
        }

        .input-group textarea:focus, .input-group input:focus {
          border-color: var(--primary);
        }

        .upload-dropzone {
          border: 2px dashed var(--glass-border);
          border-radius: 14px;
          padding: 2rem 1rem;
          text-align: center;
          margin-bottom: 1.5rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .upload-dropzone:hover {
          border-color: var(--primary);
          background: var(--primary-glow);
        }

        .dropzone-inner p {
          font-weight: 700;
          margin-top: 0.5rem;
          font-size: 0.9rem;
        }

        .dropzone-inner span {
          font-size: 0.75rem;
          opacity: 0.5;
          display: block;
          margin-top: 0.2rem;
        }

        .selected-files {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .file-item {
          display: flex;
          align-items: center;
          gap: 0.8rem;
          background: white;
          padding: 0.6rem;
          border-radius: 8px;
          border: 1px solid var(--card-border);
          text-align: left;
        }

        .file-details {
          flex: 1;
          min-width: 0;
        }

        .file-details p {
          font-size: 0.85rem;
          font-weight: 700;
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .file-details span {
          font-size: 0.75rem;
          opacity: 0.5;
        }

        .file-item button {
          background: transparent;
          border: none;
          color: #EF4444;
          cursor: pointer;
          font-weight: 700;
          padding: 0.3rem;
        }

        .net-earnings-card {
          background: #F8FAFC;
          border: 1px solid var(--card-border);
          padding: 0.8rem 1rem;
          border-radius: 8px;
          font-size: 0.85rem;
          margin-top: 0.5rem;
        }

        .net-row {
          display: flex;
          justify-content: space-between;
          color: #64748b;
          margin-bottom: 0.3rem;
        }

        .net-row.earnings {
          border-top: 1px solid rgba(0,0,0,0.05);
          padding-top: 0.5rem;
          margin-top: 0.5rem;
          color: var(--primary);
          font-weight: 700;
          font-size: 0.95rem;
        }

        .progress-bar-container {
          background: rgba(0,0,0,0.05);
          border-radius: 100px;
          height: 6px;
          width: 100%;
          overflow: hidden;
          position: relative;
          margin-top: 1.5rem;
        }

        .progress-fill {
          background: var(--primary);
          height: 100%;
          transition: width 0.3s;
        }

        .progress-text {
          font-size: 0.75rem;
          color: #64748b;
          display: block;
          text-align: right;
          margin-top: 0.3rem;
        }

        .not-found-screen {
          text-align: center;
          padding: 6rem 2rem;
          font-family: inherit;
        }

        .not-found-screen h2 {
          font-size: 1.8rem;
          font-weight: 800;
          margin: 1.5rem 0 0.5rem;
        }

        .not-found-screen p {
          color: #64748b;
        }

        @media (max-width: 900px) {
          .task-layout {
            grid-template-columns: 1fr;
          }
          .task-brief-col {
            padding: 1.5rem;
          }
          .task-brief-col h1 {
            font-size: 2rem;
          }
          .task-metadata-grid {
            grid-template-columns: 1fr;
            gap: 0.75rem;
          }
        }
      `}</style>
      {/* Report Modal */}
      {isReportModalOpen && (
        <div className="modal-overlay">
          <div className="glass-card" style={{ maxWidth: '450px', width: '100%', padding: '2rem' }}>
            <h3 style={{ marginTop: 0 }}>Report Brief</h3>
            <p style={{ color: '#64748b', fontSize: '0.9rem' }}>If this task brief violates Lipapata rules or involves copyright infringement, let us know.</p>
            <form onSubmit={handleReportTask}>
              <div className="input-group" style={{ margin: '1rem 0' }}>
                <label>Reason for Report</label>
                <select value={reportReason} onChange={(e) => setReportReason(e.target.value)} style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                  <option value="Copyright Infringement">Copyright Infringement / Stolen Content</option>
                  <option value="Scam / Fraud">Scam / Fraud / Unreasonable Demands</option>
                  <option value="Inappropriate Content">Inappropriate Content</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="input-group" style={{ marginBottom: '1.5rem' }}>
                <label>Details / Explanation</label>
                <textarea rows={3} value={reportDesc} onChange={(e) => setReportDesc(e.target.value)} placeholder="Provide additional details..." style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1' }} required />
              </div>
              <div className="modal-actions" style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn-secondary" onClick={() => setIsReportModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={isSubmittingReport}>
                  {isSubmittingReport ? 'Submitting...' : 'Submit Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
