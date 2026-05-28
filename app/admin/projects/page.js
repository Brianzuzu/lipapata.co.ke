'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, doc, deleteDoc, query, orderBy, updateDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { 
  FileText, 
  Trash2, 
  Eye, 
  AlertTriangle, 
  User, 
  ExternalLink,
  Image as ImageIcon,
  Film,
  Search,
  ArrowLeft
} from 'lucide-react';
import Link from 'next/link';

export default function AdminProjects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'projects'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      setProjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const deleteProject = async (id) => {
    if (!confirm("Are you sure you want to permanently delete this content? This action cannot be undone.")) return;
    try {
      await deleteDoc(doc(db, 'projects', id));
      setProjects(projects.filter(p => p.id !== id));
    } catch (err) {
      alert("Failed to delete project");
    }
  };

  const filteredProjects = projects.filter(p => 
    p.title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.fileName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="admin-page">
      <header className="page-header">
        <div className="header-text">
          <Link href="/admin" className="back-btn" style={{ textDecoration: 'none', color: '#64748b' }}>
            <ArrowLeft size={16} /> Back to Overview
          </Link>
          <h1>Asset Inventory</h1>
          <p>Review and manage every digital product on the platform</p>
        </div>
        <div className="header-actions">
          <div className="search-bar glass-card">
            <Search size={18} />
            <input 
              type="text" 
              placeholder="Search by title, filename or creator..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="btn-refresh" onClick={fetchProjects}>Refresh List</button>
        </div>
      </header>

      <div className="table-wrapper glass-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Content Item</th>
              <th>Creator</th>
              <th>Pricing</th>
              <th>Performance</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredProjects.map(p => (
              <tr key={p.id}>
                <td>
                  <div className="project-info">
                    <div className="type-badge" style={{ background: p.resourceType === 'video' ? '#EEF2FF' : '#F0FDF4', color: p.resourceType === 'video' ? '#4F46E5' : '#16A34A' }}>
                      {p.resourceType === 'video' ? <Film size={18} /> : <ImageIcon size={18} />}
                    </div>
                    <div className="text-details">
                      <div className="title">{p.title || p.fileName}</div>
                      <div className="meta">{p.format?.toUpperCase()} • {(p.fileSize / 1024 / 1024).toFixed(1)} MB</div>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="creator-info">
                    <User size={14} className="icon-subtle" />
                    <span>{p.uid?.slice(0, 10)}...</span>
                  </div>
                </td>
                <td>
                  <div className="price-tag">KSh {p.price?.toLocaleString()}</div>
                </td>
                <td>
                  <div className="stats-info">
                    <strong>{p.downloadCount || 0}</strong>
                    <span>Sales</span>
                  </div>
                </td>
                <td>
                  <span className={`status-pill ${p.status?.toLowerCase() || 'active'}`}>
                    {p.status || 'Active'}
                  </span>
                </td>
                <td>
                  <div className="action-row">
                    <button className="action-btn" title="View Public Page" onClick={() => window.open(`/p/${p.id}`, '_blank')}>
                      <ExternalLink size={18} />
                    </button>
                    <button className="action-btn delete" title="Remove Asset" onClick={() => deleteProject(p.id)}>
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredProjects.length === 0 && !loading && (
              <tr><td colSpan="6" className="empty-state">No matching projects found in the inventory.</td></tr>
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
          width: 350px;
        }
        .search-bar input { border: none; outline: none; background: transparent; width: 100%; font-weight: 500; }
        .btn-refresh { background: #000; color: #fff; border: none; padding: 0.7rem 1.4rem; border-radius: 12px; font-weight: 600; cursor: pointer; transition: 0.2s; }
        .btn-refresh:hover { opacity: 0.8; }

        .table-wrapper { padding: 0; overflow: hidden; }
        .admin-table { width: 100%; border-collapse: collapse; }
        .admin-table th { text-align: left; padding: 1.2rem; background: #F8FAFC; color: #64748b; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px; }
        .admin-table td { padding: 1.2rem; border-bottom: 1px solid #F1F5F9; color: #334155; }

        .project-info { display: flex; align-items: center; gap: 1rem; }
        .type-badge { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
        .title { font-weight: 700; color: #000; margin-bottom: 0.2rem; }
        .meta { font-size: 0.75rem; color: #94a3b8; font-weight: 500; }

        .creator-info { display: flex; align-items: center; gap: 0.5rem; color: #64748b; font-size: 0.85rem; }
        .icon-subtle { opacity: 0.4; }

        .price-tag { font-weight: 800; color: var(--primary); }
        
        .stats-info { display: flex; flex-direction: column; gap: 0.1rem; }
        .stats-info strong { font-size: 1rem; color: #000; }
        .stats-info span { font-size: 0.75rem; color: #94a3b8; }

        .status-pill { padding: 0.4rem 0.8rem; border-radius: 20px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; }
        .status-pill.active { background: #DCFCE7; color: #166534; }
        .status-pill.pending { background: #FEF3C7; color: #92400E; }

        .action-row { display: flex; gap: 0.8rem; }
        .action-btn { background: #F8FAFC; border: 1px solid #E2E8F0; color: #64748b; width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s; }
        .action-btn:hover { background: #F1F5F9; color: var(--primary); border-color: var(--primary); }
        .action-btn.delete:hover { color: #EF4444; border-color: #EF4444; background: #FEF2F2; }

        .empty-state { text-align: center; padding: 5rem; color: #94a3b8; font-style: italic; }
      `}</style>
    </div>
  );
}
