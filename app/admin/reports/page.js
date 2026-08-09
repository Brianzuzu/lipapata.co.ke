'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, doc, getDoc, updateDoc, query, orderBy } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../../../lib/firebase';
import { useRouter } from 'next/navigation';
import { Search, ArrowLeft, Calendar, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function AdminReports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actioningId, setActioningId] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/login');
        return;
      }
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists() || userDoc.data()?.role?.trim() !== 'admin') {
          router.push('/login');
          return;
        }
        fetchReports();
      } catch (err) {
        console.error('Error verifying admin auth:', err);
        router.push('/login');
      }
    });

    return () => unsubscribe();
  }, [router]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'reports'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      setReports(snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })));
    } catch (err) {
      console.error('Error fetching reports:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (reportId, newStatus) => {
    setActioningId(reportId);
    try {
      await updateDoc(doc(db, 'reports', reportId), { status: newStatus });
      setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: newStatus } : r));
    } catch (err) {
      console.error('Failed to update report status:', err);
      alert('Failed to update status');
    } finally {
      setActioningId(null);
    }
  };

  const formatDate = (createdAt) => {
    if (!createdAt) return 'N/A';
    try {
      if (typeof createdAt.toDate === 'function') {
        return createdAt.toDate().toLocaleDateString();
      }
      if (createdAt.seconds) {
        return new Date(createdAt.seconds * 1000).toLocaleDateString();
      }
      return new Date(createdAt).toLocaleDateString();
    } catch (e) {
      return 'N/A';
    }
  };

  const filteredReports = reports.filter(r =>
    (r.reportedType && r.reportedType.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (r.reason && r.reason.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (r.description && r.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (r.reporterUid && r.reporterUid.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (r.reportedUid && r.reportedUid.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (r.status && r.status.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="admin-page">
      <header className="page-header">
        <div className="header-text">
          <Link href="/admin" className="back-btn" style={{ textDecoration: 'none', color: '#64748b' }}>
            <ArrowLeft size={16} /> Back to Overview
          </Link>
          <h1>Reports Moderation</h1>
          <p>Review and act on user and content reports</p>
        </div>
        <div className="header-actions">
          <div className="search-bar glass-card">
            <Search size={18} />
            <input 
              type="text" 
              placeholder="Search reports..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="btn-refresh" onClick={fetchReports}>Refresh List</button>
        </div>
      </header>

      <div className="table-wrapper glass-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Reason</th>
              <th>Description</th>
              <th>Reporter UID</th>
              <th>Reported UID</th>
              <th>Status</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredReports.map(report => (
              <tr key={report.id} className={`row-${report.status || 'pending'}`}>
                <td>
                  <span className="type-badge">{report.reportedType || 'N/A'}</span>
                </td>
                <td>
                  <div className="font-bold">{report.reason || 'N/A'}</div>
                </td>
                <td>
                  <div className="description-text">{report.description || 'No description provided'}</div>
                </td>
                <td>
                  <span className="uid-code" title={report.reporterUid}>{report.reporterUid || 'N/A'}</span>
                </td>
                <td>
                  <span className="uid-code" title={report.reportedUid}>{report.reportedUid || 'N/A'}</span>
                </td>
                <td>
                  <span className={`status-pill ${report.status || 'pending'}`}>
                    {report.status || 'pending'}
                  </span>
                </td>
                <td>
                  <div className="date-badge">
                    <Calendar size={12} /> {formatDate(report.createdAt)}
                  </div>
                </td>
                <td>
                  <div className="action-row">
                    <button 
                      onClick={() => handleUpdateStatus(report.id, 'dismissed')}
                      disabled={actioningId === report.id || report.status === 'dismissed'}
                      className="action-btn-dismiss"
                      title="Dismiss Report"
                    >
                      Dismiss
                    </button>
                    <button 
                      onClick={() => handleUpdateStatus(report.id, 'actioned')}
                      disabled={actioningId === report.id || report.status === 'actioned'}
                      className="action-btn-remove"
                      title="Remove Content"
                    >
                      Remove Content
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredReports.length === 0 && !loading && (
              <tr>
                <td colSpan="8" className="empty-state">
                  No reports found.
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan="8" className="empty-state">
                  <Loader2 className="spin" size={24} style={{ margin: '0 auto' }} />
                  <p style={{ marginTop: '0.5rem' }}>Loading reports...</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <style jsx>{`
        .admin-page { display: flex; flex-direction: column; gap: 2.5rem; }
        .page-header { display: flex; justify-content: space-between; align-items: flex-end; }
        
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
        }
        .back-btn:hover, .back-btn:active { 
          color: var(--primary) !important; 
          border-color: var(--primary) !important;
          background: #F0FDF4 !important;
          transform: translateX(-4px);
          box-shadow: 0 4px 6px rgba(34, 197, 129, 0.05);
          text-decoration: none !important;
        }

        .header-text h1 { font-size: 2.2rem; margin-bottom: 0.5rem; color: #000; }
        .header-text p { color: #64748b; }

        .header-actions { display: flex; gap: 1.5rem; align-items: center; }
        .search-bar { 
          background: #FFFFFF; 
          border: 1px solid var(--card-border); 
          padding: 0.6rem 1.2rem; 
          border-radius: 12px; 
          display: flex; 
          align-items: center; 
          gap: 0.8rem;
          width: 300px;
        }
        .search-bar input { border: none; outline: none; background: transparent; width: 100%; font-weight: 500; }
        .btn-refresh { background: #000; color: #fff; border: none; padding: 0.7rem 1.4rem; border-radius: 12px; font-weight: 600; cursor: pointer; }

        .table-wrapper { padding: 0; overflow: hidden; }
        .admin-table { width: 100%; border-collapse: collapse; }
        .admin-table th { text-align: left; padding: 1.2rem; background: #F8FAFC; color: #64748b; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px; }
        .admin-table td { padding: 1.2rem; border-bottom: 1px solid #F1F5F9; color: #334155; }

        .type-badge { font-size: 0.75rem; text-transform: uppercase; font-weight: 700; background: #F1F5F9; color: #475569; padding: 0.3rem 0.6rem; border-radius: 6px; }
        .font-bold { font-weight: 700; color: #000; }
        .description-text { font-size: 0.85rem; color: #475569; max-width: 260px; word-break: break-word; }
        .uid-code { font-family: monospace; font-size: 0.8rem; background: #F8FAFC; padding: 0.2rem 0.5rem; border-radius: 4px; border: 1px solid #E2E8F0; color: #64748b; display: inline-block; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        .status-pill { padding: 0.4rem 0.8rem; border-radius: 20px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; display: inline-block; }
        .status-pill.pending { background: #FEF3C7; color: #92400E; }
        .status-pill.actioned { background: #FEE2E2; color: #991B1B; }
        .status-pill.dismissed { background: #F1F5F9; color: #64748B; }

        .date-badge { display: flex; align-items: center; gap: 0.5rem; color: #94a3b8; font-size: 0.85rem; }

        .action-row { display: flex; gap: 0.5rem; }
        .action-btn-dismiss { background: #F8FAFC; border: 1px solid #E2E8F0; color: #475569; padding: 0.4rem 0.8rem; border-radius: 8px; font-weight: 600; font-size: 0.8rem; cursor: pointer; transition: 0.2s; }
        .action-btn-dismiss:hover:not(:disabled) { background: #F1F5F9; color: #000; border-color: #CBD5E1; }
        .action-btn-dismiss:disabled { opacity: 0.5; cursor: not-allowed; }

        .action-btn-remove { background: #FEF2F2; border: 1px solid #FCA5A5; color: #EF4444; padding: 0.4rem 0.8rem; border-radius: 8px; font-weight: 600; font-size: 0.8rem; cursor: pointer; transition: 0.2s; }
        .action-btn-remove:hover:not(:disabled) { background: #FEE2E2; color: #991B1B; border-color: #F87171; }
        .action-btn-remove:disabled { opacity: 0.5; cursor: not-allowed; }

        .empty-state { text-align: center; padding: 4rem; color: #94a3b8; font-style: italic; }

        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }

        @media (max-width: 768px) {
          .page-header { flex-direction: column; align-items: flex-start; gap: 1rem; }
          .header-actions { width: 100%; flex-direction: column; align-items: stretch; gap: 1rem; }
          .search-bar { width: 100%; }
          .table-wrapper { overflow-x: auto; -webkit-overflow-scrolling: touch; }
          .admin-table { min-width: 900px; }
        }
      `}</style>
    </div>
  );
}
