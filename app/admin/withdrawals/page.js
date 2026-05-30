'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, query, orderBy, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { 
  Banknote, 
  Clock, 
  CheckCircle, 
  XCircle, 
  ExternalLink, 
  User, 
  ArrowRight,
  Loader2
} from 'lucide-react';

export default function AdminWithdrawals() {
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    fetchWithdrawals();
  }, []);

  const fetchWithdrawals = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'withdrawals'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      setWithdrawals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleWithdrawal = async (id, status) => {
    try {
      await updateDoc(doc(db, 'withdrawals', id), { 
        status, 
        processedAt: serverTimestamp() 
      });
      setWithdrawals(withdrawals.map(w => w.id === id ? { ...w, status } : w));
    } catch (err) {
      alert("Failed to update status");
    }
  };

  const handlePayout = async (withdrawalId) => {
    if (!confirm('Are you sure you want to trigger an automated M-Pesa payout for this request?')) return;
    
    setProcessingId(withdrawalId);
    try {
      const response = await fetch('/api/admin/payout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ withdrawalId })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Payout failed');
      }

      alert('Payout initiated! M-Pesa is processing the request.');
      fetchWithdrawals(); // Refresh list
    } catch (err) {
      console.error('Payout error:', err);
      alert(err.message);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="admin-page">
      <header className="page-header">
        <div>
          <h1>Withdrawal Requests</h1>
          <p>Review and process creator payout requests</p>
        </div>
      </header>

      <div className="table-container glass-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Creator</th>
              <th>M-Pesa Number</th>
              <th>Requested</th>
              <th>Net to Send</th>
              <th>Status</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {withdrawals.length > 0 ? withdrawals.map(w => (
              <tr key={w.id}>
                <td>
                  <div className="creator-info">
                    <User size={16} opacity={0.5} />
                    <span>{w.creatorName || w.creatorUid}</span>
                  </div>
                </td>
                <td><div className="phone-badge">{w.phoneNumber}</div></td>
                <td><span style={{ opacity: 0.5, fontSize: '0.85rem' }}>KSh {w.amount?.toLocaleString()}</span></td>
                <td><span className="amount-val">KSh {(w.netAmount || w.amount)?.toLocaleString()}</span></td>
                <td>
                  <span className={`status-tag ${w.status}`}>
                    {w.status === 'completed' ? <CheckCircle size={12} /> : 
                     w.status === 'pending' ? <Clock size={12} /> : 
                     w.status === 'processing' ? <Loader2 className="spin" size={12} /> :
                     <XCircle size={12} />}
                    {w.status}
                  </span>
                </td>
                <td><div className="date">{w.createdAt?.toDate ? w.createdAt.toDate().toLocaleDateString() : 'Just now'}</div></td>
                <td>
                  <div className="action-btns">
                    {w.status === 'pending' && (
                      <>
                        <button 
                          onClick={() => handlePayout(w.id)} 
                          className="btn-approve"
                          style={{ background: '#3b82f6', color: 'white' }}
                          disabled={processingId === w.id}
                        >
                          {processingId === w.id ? <Loader2 className="spin" size={12} /> : '✅ Approve & Pay via Paywave'}
                        </button>
                        <button onClick={() => handleWithdrawal(w.id, 'rejected')} className="btn-reject" disabled={processingId === w.id}>Reject</button>
                      </>
                    )}
                    {w.status === 'processing' && (
                      <button 
                        onClick={() => handleWithdrawal(w.id, 'completed')} 
                        className="btn-mark-paid"
                        style={{ background: '#10b981', color: 'black', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '0.85rem', width: '100%' }}
                      >
                        Confirm Manual Payment
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '4rem', opacity: 0.5 }}>
                  No withdrawal requests found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <style jsx>{`
        .admin-page { display: flex; flex-direction: column; gap: 2rem; }
        .page-header h1 { font-size: 2rem; }
        
        .table-container { padding: 0; overflow: hidden; }
        .admin-table { width: 100%; border-collapse: collapse; }
        .admin-table th { padding: 1.2rem; text-align: left; opacity: 0.4; font-size: 0.8rem; text-transform: uppercase; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .admin-table td { padding: 1.2rem; border-bottom: 1px solid rgba(255,255,255,0.02); }
        
        .creator-info { display: flex; align-items: center; gap: 0.5rem; font-weight: 600; }
        .phone-badge { background: rgba(255,255,255,0.05); padding: 0.3rem 0.6rem; border-radius: 6px; font-family: monospace; font-size: 0.9rem; }
        
        .amount-val { color: #10b981; font-weight: 800; font-size: 1.1rem; }
        
        .status-tag { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.3rem 0.6rem; border-radius: 6px; font-size: 0.75rem; text-transform: capitalize; font-weight: 600; }
        .status-tag.completed { background: rgba(16, 185, 129, 0.1); color: #10b981; }
        .status-tag.pending { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
        .status-tag.processing { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
        .status-tag.failed { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
        .status-tag.rejected { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
        
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        
        .date { font-size: 0.85rem; opacity: 0.5; }
        
        .action-btns { display: flex; gap: 0.8rem; }
        .btn-approve { background: #10b981; color: black; border: none; padding: 0.5rem 1rem; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 0.85rem; }
        .btn-reject { background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); padding: 0.5rem 1rem; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 0.85rem; }
        
        @media (max-width: 768px) {
          .table-container { overflow-x: auto; -webkit-overflow-scrolling: touch; }
          .admin-table { min-width: 800px; }
          .page-header { text-align: center; }
        }
      `}</style>
    </div>
  );
}
