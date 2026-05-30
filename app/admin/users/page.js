'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { Search, Shield, ShieldOff, MoreHorizontal, Mail, Phone, Calendar, Banknote, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleUserStatus = async (userId, currentStatus) => {
    const newStatus = currentStatus === 'suspended' ? 'active' : 'suspended';
    try {
      await updateDoc(doc(db, 'users', userId), { status: newStatus });
      setUsers(users.map(u => u.id === userId ? { ...u, status: newStatus } : u));
    } catch (err) {
      alert("Failed to update user status");
    }
  };

  const filteredUsers = users.filter(u => 
    u.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.phone?.includes(searchTerm)
  );

  return (
    <div className="admin-page">
      <header className="page-header">
        <div className="header-text">
          <Link href="/admin" className="back-btn" style={{ textDecoration: 'none', color: '#64748b' }}>
            <ArrowLeft size={16} /> Back to Overview
          </Link>
          <h1>Creator Management</h1>
          <p>Monitor and manage all platform creators</p>
        </div>
        <div className="header-actions">
          <div className="search-bar glass-card">
            <Search size={18} />
            <input 
              type="text" 
              placeholder="Search creators..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="btn-refresh" onClick={fetchUsers}>Refresh List</button>
        </div>
      </header>

      <div className="table-wrapper glass-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Creator Profile</th>
              <th>Contact Details</th>
              <th>Platform Balance</th>
              <th>Status</th>
              <th>Joined Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map(user => (
              <tr key={user.id} className={user.status === 'suspended' ? 'row-suspended' : ''}>
                <td>
                  <div className="user-profile">
                    <div className="avatar">{user.name?.charAt(0) || 'U'}</div>
                    <div className="user-details">
                      <div className="name">{user.name || 'Anonymous'}</div>
                      <div className="role-tag">{user.role || 'Creator'}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="contact-info">
                    <div className="contact-row"><Mail size={12} /> {user.email}</div>
                    <div className="contact-row"><Phone size={12} /> {user.phone || 'No phone'}</div>
                  </div>
                </td>
                <td>
                  <div className="balance-badge">
                    <Banknote size={14} />
                    <span>KSh {(user.balance || 0).toLocaleString()}</span>
                  </div>
                </td>
                <td>
                  <span className={`status-pill ${user.status || 'active'}`}>
                    {user.status || 'active'}
                  </span>
                </td>
                <td>
                  <div className="date-badge"><Calendar size={12} /> {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}</div>
                </td>
                <td>
                  <div className="action-row">
                    <button 
                      onClick={() => toggleUserStatus(user.id, user.status)}
                      className={`action-btn ${user.status === 'suspended' ? 'unsuspend' : 'suspend'}`}
                      title={user.status === 'suspended' ? 'Unsuspend' : 'Suspend'}
                    >
                      {user.status === 'suspended' ? <Shield size={18} /> : <ShieldOff size={18} />}
                    </button>
                    <button className="action-btn"><MoreHorizontal size={18} /></button>
                  </div>
                </td>
              </tr>
            ))}
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

        .user-profile { display: flex; align-items: center; gap: 1rem; }
        .avatar { width: 42px; height: 42px; background: #F0FDF4; color: var(--primary); display: flex; align-items: center; justify-content: center; border-radius: 12px; font-weight: 800; border: 1px solid rgba(34, 197, 129, 0.1); }
        .name { font-weight: 700; color: #000; margin-bottom: 0.1rem; }
        .role-tag { font-size: 0.7rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }

        .contact-info { display: flex; flex-direction: column; gap: 0.3rem; }
        .contact-row { display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; color: #64748b; }

        .balance-badge { display: flex; align-items: center; gap: 0.5rem; color: #166534; font-weight: 800; background: #DCFCE7; padding: 0.4rem 0.8rem; border-radius: 8px; width: fit-content; }
        
        .status-pill { padding: 0.4rem 0.8rem; border-radius: 20px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; }
        .status-pill.active { background: #DCFCE7; color: #166534; }
        .status-pill.suspended { background: #FEE2E2; color: #991B1B; }

        .date-badge { display: flex; align-items: center; gap: 0.5rem; color: #94a3b8; font-size: 0.85rem; }

        .action-row { display: flex; gap: 0.8rem; }
        .action-btn { background: #F8FAFC; border: 1px solid #E2E8F0; color: #64748b; width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s; }
        .action-btn:hover { background: #F1F5F9; color: var(--primary); border-color: var(--primary); }
        .action-btn.suspend:hover { color: #EF4444; border-color: #EF4444; background: #FEF2F2; }
        .action-btn.unsuspend { color: #16A34A; border-color: #BBF7D0; background: #F0FDF4; }

        .row-suspended { background: #FBFBFA; opacity: 0.7; }

        @media (max-width: 768px) {
          .page-header { flex-direction: column; align-items: flex-start; gap: 1rem; }
          .header-actions { width: 100%; flex-direction: column; align-items: stretch; gap: 1rem; }
          .search-bar { width: 100%; }
          .table-wrapper { overflow-x: auto; -webkit-overflow-scrolling: touch; }
          .admin-table { min-width: 800px; }
        }
      `}</style>
    </div>
  );
}
