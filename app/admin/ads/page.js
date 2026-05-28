'use client';

import { useState, useEffect, useRef } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { Image, Plus, Trash2, ExternalLink, Loader2, AlertCircle, Upload, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function AdminAds() {
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newAd, setNewAd] = useState({ title: '', imageUrl: '', linkUrl: '' });
  const [status, setStatus] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const SLIDE_LIMIT = 10;

  useEffect(() => {
    fetchAds();
  }, []);

  const fetchAds = async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, 'ads'));
      setAds(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAd = async (e) => {
    e.preventDefault();
    if (!newAd.imageUrl) {
      setStatus({ type: 'error', text: 'Please upload or provide an image URL' });
      return;
    }
    
    setIsAdding(true);
    try {
      await addDoc(collection(db, 'ads'), {
        ...newAd,
        createdAt: serverTimestamp()
      });
      setNewAd({ title: '', imageUrl: '', linkUrl: '' });
      setIsAdding(false);
      fetchAds();
      setStatus({ type: 'success', text: 'Ad added successfully!' });
    } catch (err) {
      setStatus({ type: 'error', text: 'Failed to add ad.' });
      setIsAdding(false);
    }
  };

  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploading(true);
    setStatus(null);
    setUploadProgress({ current: 0, total: files.length });

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadProgress(prev => ({ ...prev, current: i + 1 }));

      const formData = new FormData();
      formData.append('file', file);

      try {
        console.log(`Uploading file ${i + 1}/${files.length}: ${file.name}`);
        const res = await fetch('/api/admin/upload', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload failed at API level');

        console.log(`File uploaded to Cloudinary, saving to Firestore...`, data.url);

        // Automatically create the ad document
        try {
          await addDoc(collection(db, 'ads'), {
            title: file.name.split('.')[0].replace(/[-_]/g, ' '), 
            imageUrl: data.url,
            linkUrl: '',
            createdAt: serverTimestamp()
          });
          console.log(`Document saved to Firestore successfully`);
          successCount++;
        } catch (dbErr) {
          console.error("Firestore Save Error:", dbErr);
          throw new Error(`Database error: ${dbErr.message}`);
        }
        
      } catch (err) {
        console.error(`Full error for ${file.name}:`, err);
        alert(`Failed to add slide "${file.name}": ${err.message}`);
        errorCount++;
      }
    }

    setUploading(false);
    setUploadProgress({ current: 0, total: 0 });
    fetchAds();
    setIsAdding(false);

    if (errorCount === 0) {
      setStatus({ type: 'success', text: `Successfully added ${successCount} slides!` });
    } else {
      const errorMessage = successCount > 0 
        ? `Added ${successCount} slides, but ${errorCount} failed.` 
        : `All ${errorCount} uploads failed. Check console or permissions.`;
      setStatus({ type: 'error', text: errorMessage });
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Remove this slide?')) return;
    try {
      await deleteDoc(doc(db, 'ads', id));
      setAds(ads.filter(a => a.id !== id));
    } catch (err) {
      alert('Failed to delete ad');
    }
  };

  return (
    <div className="admin-page">
      <header className="page-header">
        <div>
          <Link href="/admin" className="back-btn" style={{ textDecoration: 'none', color: '#64748b' }}>
            <ArrowLeft size={16} /> Back to Overview
          </Link>
          <h1>Slide Ad Management</h1>
          <p>Manage the promotional carousel on the landing page</p>
          <div className="limit-indicator">
            <div className={`count ${ads.length >= SLIDE_LIMIT ? 'at-limit' : ''}`}>
              {ads.length} / {SLIDE_LIMIT} slides used
            </div>
            {ads.length >= SLIDE_LIMIT && <span className="limit-warning">Limit reached! Remove a slide to add a new one.</span>}
          </div>
        </div>
        <div className="header-actions">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept="image/*" 
            multiple 
            style={{ display: 'none' }} 
          />
          <button 
            className="btn-secondary" 
            onClick={() => fileInputRef.current.click()}
            disabled={uploading || ads.length >= SLIDE_LIMIT}
          >
            {uploading ? <Loader2 className="spin" size={18} /> : <Upload size={18} />}
            {uploading ? `Uploading ${uploadProgress.current}/${uploadProgress.total}` : 'Batch Upload'}
          </button>
          <button 
            className="btn-primary" 
            onClick={() => setIsAdding(true)}
            disabled={ads.length >= SLIDE_LIMIT}
          >
            <Plus size={18} /> Add Manually
          </button>
        </div>
      </header>

      {status && (
        <div className={`status-message ${status.type}`} style={{ maxWidth: '600px' }}>
          {status.type === 'error' ? <AlertCircle size={16} /> : null}
          {status.text}
          <button className="close-status" onClick={() => setStatus(null)}>×</button>
        </div>
      )}

      <div className="ads-grid">
        {ads.length > 0 ? ads.map(ad => (
          <div key={ad.id} className="ad-card glass-card">
            <div className="ad-preview">
              <img src={ad.imageUrl} alt={ad.title} />
              <button className="delete-btn" onClick={() => handleDelete(ad.id)}><Trash2 size={16} /></button>
            </div>
            <div className="ad-info">
              <div className="ad-header">
                <input 
                  type="text" 
                  defaultValue={ad.title} 
                  onBlur={async (e) => {
                    if (e.target.value !== ad.title) {
                      await updateDoc(doc(db, 'ads', ad.id), { title: e.target.value });
                    }
                  }}
                  placeholder="Slide Title..."
                  className="inline-input"
                />
              </div>
              <div className="ad-link-edit">
                <input 
                  type="text" 
                  defaultValue={ad.linkUrl} 
                  onBlur={async (e) => {
                    if (e.target.value !== ad.linkUrl) {
                      await updateDoc(doc(db, 'ads', ad.id), { linkUrl: e.target.value });
                    }
                  }}
                  placeholder="Target Link (URL)..."
                  className="inline-input link"
                />
              </div>
              {ad.linkUrl && <a href={ad.linkUrl} target="_blank" rel="noreferrer" className="preview-link"><ExternalLink size={12} /> Test Link</a>}
            </div>
          </div>
        )) : !loading && (
          <div className="empty-state-full" onClick={() => fileInputRef.current.click()}>
            <div className="empty-icon"><Image size={48} /></div>
            <h3>No slides yet</h3>
            <p>Click here to batch upload your first promotional slides</p>
          </div>
        )}
        {loading && [1,2,3].map(i => <div key={i} className="ad-card skeleton"></div>)}
      </div>

      {isAdding && (
        <div className="modal-overlay">
          <div className="modal glass-card">
            <h3>Add New Slide Ad</h3>
            <form onSubmit={handleAddAd}>
              <div className="input-group">
                <label>Ad Title (Optional)</label>
                <input 
                  type="text" 
                  value={newAd.title} 
                  onChange={(e) => setNewAd({...newAd, title: e.target.value})} 
                  placeholder="e.g. 50% Off Creator Plan"
                />
              </div>

              <div className="input-group">
                <label>Slide Image</label>
                <div 
                  className="upload-box" 
                  onClick={() => fileInputRef.current.click()}
                  style={{ backgroundImage: newAd.imageUrl ? `url(${newAd.imageUrl})` : 'none' }}
                >
                  {!newAd.imageUrl && !uploading && (
                    <div className="upload-placeholder">
                      <Upload size={24} />
                      <span>Click to upload slide</span>
                    </div>
                  )}
                </div>
                <div className="url-fallback">
                  <span>or paste image URL</span>
                  <input 
                    type="url" 
                    value={newAd.imageUrl} 
                    onChange={(e) => setNewAd({...newAd, imageUrl: e.target.value})} 
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div className="input-group">
                <label>Action Link (URL)</label>
                <input 
                  type="url" 
                  value={newAd.linkUrl} 
                  onChange={(e) => setNewAd({...newAd, linkUrl: e.target.value})} 
                  placeholder="https://..."
                />
              </div>
              
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => { setIsAdding(false); setStatus(null); }}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={isAdding || uploading}>
                  {isAdding ? <Loader2 className="spin" size={18} /> : 'Save Slide'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        .admin-page { display: flex; flex-direction: column; gap: 2.5rem; }
        .back-btn, .back-btn:link, .back-btn:visited { 
          display: inline-flex; 
          align-items: center; 
          gap: 0.6rem; 
          color: #64748b !important; 
          text-decoration: none !important; 
          font-size: 0.85rem; 
          font-weight: 700; 
          margin-bottom: 1.5rem;
          transition: all 0.2s ease;
          background: #FFFFFF;
          padding: 0.5rem 1rem;
          border-radius: 100px;
          border: 1px solid #E2E8F0;
          box-shadow: 0 2px 4px rgba(0,0,0,0.02);
          width: fit-content;
        }
        .back-btn:hover, .back-btn:active { 
          color: var(--primary) !important; 
          border-color: var(--primary) !important;
          background: #F0FDF4 !important;
          transform: translateX(-4px);
          box-shadow: 0 4px 6px rgba(34, 197, 129, 0.05);
        }
        .header-actions { display: flex; gap: 0.8rem; }
        
        .limit-indicator { margin-top: 1rem; display: flex; align-items: center; gap: 1rem; }
        .count { font-size: 0.85rem; font-weight: 700; background: rgba(255,255,255,0.05); padding: 0.3rem 0.8rem; border-radius: 6px; }
        .count.at-limit { color: #ef4444; background: rgba(239, 68, 68, 0.1); }
        .limit-warning { font-size: 0.8rem; color: #ef4444; font-weight: 600; }
        
        .ads-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem; }
        .ad-card { overflow: hidden; padding: 0; transition: transform 0.2s ease; border: 1px solid rgba(255,255,255,0.05); }
        .ad-card:hover { transform: translateY(-4px); border-color: var(--primary); }
        
        .ad-preview { position: relative; height: 140px; background: #000; }
        .ad-preview img { width: 100%; height: 100%; object-fit: cover; opacity: 0.9; }
        .delete-btn { position: absolute; top: 10px; right: 10px; background: rgba(239, 68, 68, 0.9); color: white; border: none; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; opacity: 0; transition: 0.2s; }
        .ad-card:hover .delete-btn { opacity: 1; }
        
        .ad-info { padding: 1rem; display: flex; flex-direction: column; gap: 0.5rem; }
        .inline-input { 
          width: 100%; 
          background: transparent; 
          border: 1px solid transparent; 
          color: black; 
          font-weight: 600; 
          font-size: 0.95rem; 
          padding: 0.2rem 0.4rem; 
          border-radius: 4px;
          transition: 0.2s;
        }
        .inline-input:hover { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.1); }
        .inline-input:focus { background: white; border-color: var(--primary); outline: none; color: black; }
        
        .inline-input.link { font-size: 0.8rem; font-weight: 400; opacity: 0.6; }
        .inline-input.link:focus { opacity: 1; }

        .preview-link { font-size: 0.75rem; color: var(--primary); text-decoration: none; display: flex; align-items: center; gap: 0.4rem; font-weight: 700; margin-top: 0.2rem; }
        
        .empty-state-full { 
          grid-column: 1 / -1; 
          padding: 5rem; 
          border: 2px dashed rgba(255,255,255,0.1); 
          border-radius: 20px; 
          text-align: center; 
          cursor: pointer;
          transition: 0.3s;
        }
        .empty-state-full:hover { border-color: var(--primary); background: rgba(34, 197, 129, 0.02); }
        .empty-icon { margin-bottom: 1.5rem; opacity: 0.3; color: var(--primary); }
        .empty-state-full h3 { margin-bottom: 0.5rem; }
        .empty-state-full p { opacity: 0.5; }

        .skeleton { height: 260px; background: rgba(255,255,255,0.02); animation: pulse 1.5s infinite ease-in-out; }
        @keyframes pulse { 0% { opacity: 0.5; } 50% { opacity: 1; } 100% { opacity: 0.5; } }

        .close-status { background: none; border: none; color: inherit; font-size: 1.5rem; cursor: pointer; margin-left: auto; line-height: 1; }
        
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 1000; }
        .modal { width: 100%; max-width: 450px; padding: 2.5rem; }
        .modal h3 { margin-bottom: 1.5rem; }
        
        .input-group { margin-bottom: 1.2rem; }
        .input-group label { display: block; font-size: 0.9rem; margin-bottom: 0.5rem; opacity: 0.7; }
        .input-group input { width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); padding: 0.8rem; border-radius: 10px; color: black; }
        .input-group small { font-size: 0.75rem; opacity: 0.4; display: block; margin-top: 0.4rem; }

        .upload-box { 
          width: 100%; 
          height: 120px; 
          background: rgba(255,255,255,0.03); 
          border: 2px dashed rgba(255,255,255,0.1); 
          border-radius: 12px; 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          cursor: pointer; 
          transition: 0.3s;
          background-size: cover;
          background-position: center;
          position: relative;
          margin-bottom: 1rem;
        }
        .upload-box:hover { border-color: var(--primary); background-color: rgba(34, 197, 129, 0.05); }
        .upload-placeholder { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; opacity: 0.5; }
        .upload-loader { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; color: var(--primary); }
        .change-hint { text-align: center; color: var(--primary); font-weight: 600; cursor: pointer; display: block; margin-top: -0.5rem; margin-bottom: 1rem; }
        
        .url-fallback { margin-top: 1rem; border-top: 1px solid rgba(255,255,255,0.05); pt: 1rem; }
        .url-fallback span { font-size: 0.75rem; opacity: 0.4; display: block; margin-bottom: 0.5rem; }
        
        .status-message { padding: 0.8rem; border-radius: 8px; margin-bottom: 1.5rem; font-size: 0.85rem; display: flex; align-items: center; gap: 0.5rem; }
        .status-message.success { background: rgba(16, 185, 129, 0.1); color: #10b981; }
        .status-message.error { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
        
        .modal-actions { display: flex; gap: 1rem; margin-top: 2rem; }
        .modal-actions button { flex: 1; }
        
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
