'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { 
  Search, 
  Filter, 
  CheckCircle, 
  XCircle, 
  Clock, 
  ArrowUpRight, 
  Download,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2
} from 'lucide-react';
import Link from 'next/link';

export default function AdminTransactions() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'transactions'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id, newStatus) => {
    try {
      await updateDoc(doc(db, 'transactions', id), { status: newStatus });
      setTransactions(transactions.map(t => t.id === id ? { ...t, status: newStatus } : t));
    } catch (err) {
      alert("Failed to update transaction status");
    }
  };

  const filteredTrans = transactions.filter(t => filter === 'all' || t.status === filter);

  return (
    <div className="admin-page">
      <header className="page-header">
        <div className="header-text">
          <Link href="/admin" className="back-btn" style={{ textDecoration: 'none', color: '#64748b' }}>
            <ArrowLeft size={16} /> Back to Overview
          </Link>
          <h1>Transaction History</h1>
          <p>Monitor platform revenue and individual payment records</p>
        </div>
        <div className="header-actions">
          <div className="filter-pills">
            <button className={`pill ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All</button>
            <button className={`pill ${filter === 'completed' ? 'active' : ''}`} onClick={() => setFilter('completed')}>Success</button>
            <button className={`pill ${filter === 'pending' ? 'active' : ''}`} onClick={() => setFilter('pending')}>Pending</button>
            <button className={`pill ${filter === 'failed' ? 'active' : ''}`} onClick={() => setFilter('failed')}>Failed</button>
          </div>
          <button className="btn-refresh" onClick={fetchTransactions}>Refresh Data</button>
        </div>
      </header>

      <div className="table-wrapper glass-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Reference / ID</th>
              <th>Customer Details</th>
              <th>Creator Earn</th>
              <th>Commission</th>
              <th>Total Paid</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredTrans.map(t => (
              <tr key={t.id}>
                <td>
                  <div className="ref-cell">
                    <span className="id-tag">#{t.id.slice(-6).toUpperCase()}</span>
                    <span className="checkout-ref">{t.checkoutRequestId || 'No Ref'}</span>
                  </div>
                </td>
                <td>
                  <div className="customer-info">
                    <div className="phone-num">{t.phoneNumber}</div>
                    <div className="date-time">{t.createdAt?.toDate ? t.createdAt.toDate().toLocaleString() : 'N/A'}</div>
                  </div>
                </td>
                <td><span className="creator-cut">KSh {t.creatorEarnings?.toLocaleString()}</span></td>
                <td><span className="platform-cut">KSh {t.commission?.toLocaleString()}</span></td>
                <td><span className="total-gross">KSh {t.totalAmount?.toLocaleString()}</span></td>
                <td>
                  <span className={`status-pill ${t.status || 'completed'}`}>
                    {t.status === 'completed' ? <CheckCircle2 size={12} /> : t.status === 'pending' ? <Clock size={12} /> : <XCircle size={12} />}
                    {t.status || 'Completed'}
                  </span>
                </td>
                <td>
                  <div className="action-row">
                    {t.status === 'pending' && (
                      <button onClick={() => updateStatus(t.id, 'completed')} className="action-btn success" title="Mark as Completed">
                        <CheckCircle size={18} />
                      </button>
                    )}
                    <button className="action-btn"><ArrowUpRight size={18} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredTrans.length === 0 && !loading && (
              <tr><td colSpan="7" className="empty-state">No transactions found matching your filter.</td></tr>
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
        
        .filter-pills { display: flex; gap: 0.5rem; background: #F1F5F9; padding: 0.4rem; border-radius: 14px; border: 1px solid #E2E8F0; }
        .pill { border: none; background: transparent; padding: 0.5rem 1rem; border-radius: 10px; font-size: 0.85rem; font-weight: 600; color: #64748b; cursor: pointer; transition: 0.2s; }
        .pill.active { background: #FFFFFF; color: var(--primary); box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
        
        .btn-refresh { background: #000; color: #fff; border: none; padding: 0.7rem 1.4rem; border-radius: 12px; font-weight: 600; cursor: pointer; }

        .table-wrapper { padding: 0; overflow: hidden; }
        .admin-table { width: 100%; border-collapse: collapse; }
        .admin-table th { text-align: left; padding: 1.2rem; background: #F8FAFC; color: #64748b; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px; }
        .admin-table td { padding: 1.2rem; border-bottom: 1px solid #F1F5F9; color: #334155; }

        .ref-cell { display: flex; flex-direction: column; gap: 0.2rem; }
        .id-tag { font-family: monospace; font-weight: 800; color: #000; font-size: 0.9rem; }
        .checkout-ref { font-size: 0.7rem; color: #94a3b8; }

        .customer-info { display: flex; flex-direction: column; gap: 0.2rem; }
        .phone-num { font-weight: 700; color: #334155; }
        .date-time { font-size: 0.75rem; color: #94a3b8; }

        .creator-cut { color: #8B5CF6; font-weight: 700; }
        .platform-cut { color: var(--primary); font-weight: 700; }
        .total-gross { font-weight: 800; color: #000; font-size: 1.05rem; }

        .status-pill { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.4rem 0.8rem; border-radius: 20px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; }
        .status-pill.completed { background: #DCFCE7; color: #166534; }
        .status-pill.pending { background: #FEF3C7; color: #92400E; }
        .status-pill.failed { background: #FEE2E2; color: #991B1B; }

        .action-row { display: flex; gap: 0.8rem; }
        .action-btn { background: #F8FAFC; border: 1px solid #E2E8F0; color: #64748b; width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s; }
        .action-btn:hover { background: #F1F5F9; color: var(--primary); border-color: var(--primary); }
        .action-btn.success:hover { color: #16A34A; border-color: #16A34A; background: #F0FDF4; }

        .empty-state { text-align: center; padding: 5rem; color: #94a3b8; font-style: italic; }
      `}</style>
    </div>
  );
}
