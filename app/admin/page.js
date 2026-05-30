'use client';

import { useState, useEffect } from 'react';
import { 
  Users, 
  FileText, 
  Banknote, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  ArrowUpRight,
  MoreVertical,
  Search,
  Wallet,
  Layout,
  Settings,
  LogOut,
  Image as ImageIcon
} from 'lucide-react';
import { doc, getDoc, collection, getDocs, query, orderBy, limit, where } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalProjects: 0,
    totalRevenue: 0,
    totalCommission: 0,
    pendingPayouts: 0
  });
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [recentUsers, setRecentUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const fetchAdminData = async () => {
    try {
      // 1. Fetch Stats
      const usersSnap = await getDocs(collection(db, 'users'));
      const projectsSnap = await getDocs(collection(db, 'projects'));
      const transSnap = await getDocs(collection(db, 'transactions'));
      const withdrawSnap = await getDocs(query(collection(db, 'withdrawals'), where('status', '==', 'pending')));
      
      const transactions = transSnap.docs.map(doc => doc.data());
      const completedTrans = transactions.filter(t => t.status === 'completed');
      
      const revenue = completedTrans.reduce((acc, t) => acc + (t.totalAmount || 0), 0);
      const platformProfit = completedTrans.reduce((acc, t) => acc + (t.platformFee || t.commission || 0), 0);

      setStats({
        totalUsers: usersSnap.size,
        totalProjects: projectsSnap.size,
        totalRevenue: revenue,
        totalCommission: platformProfit,
        pendingWithdrawals: withdrawSnap.size,
        totalTransactions: transactions.length
      });

      // 2. Fetch Recent Transactions
      const qTrans = query(collection(db, 'transactions'), orderBy('createdAt', 'desc'), limit(5));
      const recentTransSnap = await getDocs(qTrans);
      setRecentTransactions(recentTransSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      // 3. Fetch Recent Users
      const qUsers = query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(5));
      const recentUsersSnap = await getDocs(qUsers);
      setRecentUsers(recentUsersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

    } catch (err) {
      console.error("Error fetching admin data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const checkAdmin = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists() && userDoc.data().role === 'admin') {
          setIsAdmin(true);
          fetchAdminData();
        } else {
          router.push('/dashboard');
        }
      } else {
        router.push('/login');
      }
    });

    return () => checkAdmin();
  }, [router]);

  if (loading) return <div className="admin-loader">Loading Admin Insights...</div>;

  return (
    <div className="admin-overview">
        <header className="content-header">
          <div>
            <h1>Platform Overview</h1>
            <p>Real-time performance and user activity</p>
          </div>
          <div className="header-actions">
            <div className="search-bar">
              <Search size={18} />
              <input type="text" placeholder="Search transactions, users..." />
            </div>
            <button className="btn-refresh" onClick={() => window.location.reload()}>Refresh Data</button>
          </div>
        </header>

        <section className="stats-grid">
          <StatCard title="Total Revenue" value={`KSh ${stats.totalRevenue.toLocaleString()}`} change="+12.5%" icon={<Banknote />} color="#22C55E" />
          <StatCard title="Total Commission" value={`KSh ${stats.totalCommission.toLocaleString()}`} change="+8.2%" icon={<Wallet />} color="#3B82F6" />
          <StatCard title="Active Creators" value={stats.totalUsers.toString()} change="+5.1%" icon={<Users />} color="#8B5CF6" />
          <Link href="/admin/withdrawals" style={{ textDecoration: 'none' }}>
            <StatCard title="Pending Payouts" value={stats.pendingWithdrawals.toString()} change="Needs Attention" icon={<AlertCircle />} color="#F59E0B" />
          </Link>
        </section>

        <div className="dashboard-body">
          <section className="data-table-section">
            <div className="section-header">
              <h2>Recent Transactions</h2>
              <button className="btn-text">View All</button>
            </div>
            <div className="table-wrapper glass-card">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Asset</th>
                    <th>Creator</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTransactions.map(t => (
                    <tr key={t.id}>
                      <td className="font-bold">{t.title || 'Transaction'}</td>
                      <td>{t.creatorName || t.creatorUid?.substring(0, 8) || 'N/A'}</td>
                      <td>KSh {t.totalAmount?.toLocaleString()}</td>
                      <td><span className={`status-badge ${t.status || 'completed'}`}>{t.status || 'Completed'}</span></td>
                      <td>{t.createdAt?.toDate ? t.createdAt.toDate().toLocaleDateString() : 'Just now'}</td>
                    </tr>
                  ))}
                  {recentTransactions.length === 0 && (
                    <tr><td colSpan="5" className="empty-state">No recent transactions found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <aside className="activity-feed">
            <div className="section-header">
              <h2>New Creators</h2>
            </div>
            <div className="user-feed glass-card">
              {recentUsers.map(u => (
                <div key={u.id} className="user-row">
                  <div className="avatar">{u.name?.charAt(0) || 'U'}</div>
                  <div className="user-details">
                    <h4>{u.name || 'Anonymous'}</h4>
                    <span>{u.email}</span>
                  </div>
                  <ArrowUpRight className="row-action" size={16} />
                </div>
              ))}
            </div>
          </aside>
        </div>
        <style jsx>{`
        .admin-overview { padding: 0; }
        .content-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 3rem; }
        .content-header h1 { font-size: 2.2rem; margin-bottom: 0.5rem; color: #000; }
        .content-header p { color: #64748b; }

        .header-actions { display: flex; gap: 1.5rem; align-items: center; }
        .search-bar {
          background: #FFFFFF;
          border: 1px solid var(--card-border);
          padding: 0.6rem 1.2rem;
          border-radius: 12px;
          display: flex;
          align-items: center;
          gap: 0.8rem;
          box-shadow: 0 2px 4px rgba(0,0,0,0.02);
        }
        .search-bar input { border: none; outline: none; background: transparent; width: 200px; font-weight: 500; }
        .btn-refresh { background: #000; color: #fff; border: none; padding: 0.6rem 1.2rem; border-radius: 12px; font-weight: 600; cursor: pointer; }

        .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 2rem; margin-bottom: 4rem; }
        
        .dashboard-body { display: grid; grid-template-columns: 1fr 350px; gap: 2.5rem; }
        .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
        .section-header h2 { font-size: 1.4rem; color: #000; }

        .table-wrapper { padding: 0; overflow: hidden; }
        .admin-table { width: 100%; border-collapse: collapse; }
        .admin-table th { text-align: left; padding: 1.2rem; background: #F8FAFC; color: #64748b; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px; }
        .admin-table td { padding: 1.2rem; border-bottom: 1px solid #F1F5F9; color: #334155; font-size: 0.95rem; }
        .status-badge { padding: 0.4rem 0.8rem; border-radius: 20px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; }
        .status-badge.completed { background: #DCFCE7; color: #166534; }
        .status-badge.pending { background: #FEF3C7; color: #92400E; }

        .user-feed { padding: 1.5rem; display: flex; flex-direction: column; gap: 1.5rem; }
        .user-row { display: flex; align-items: center; gap: 1rem; }
        .avatar { width: 42px; height: 42px; background: #F0FDF4; color: var(--primary); display: flex; align-items: center; justify-content: center; border-radius: 12px; font-weight: 800; border: 1px solid rgba(34, 197, 129, 0.1); }
        .user-details h4 { font-size: 0.95rem; color: #000; }
        .user-details span { font-size: 0.8rem; color: #64748b; }
        .row-action { margin-left: auto; color: #cbd5e1; cursor: pointer; transition: 0.2s; }
        .row-action:hover { color: var(--primary); }

        .empty-state { text-align: center; padding: 4rem; color: #94a3b8; font-style: italic; }

        @media (max-width: 1024px) {
          .stats-grid { grid-template-columns: repeat(2, 1fr); }
          .dashboard-body { grid-template-columns: 1fr; }
        }

        @media (max-width: 768px) {
          .content-header { flex-direction: column; align-items: flex-start; gap: 1rem; }
          .header-actions { width: 100%; flex-direction: column; align-items: stretch; }
          .search-bar { width: 100%; }
          .search-bar input { width: 100%; }
          .stats-grid { grid-template-columns: 1fr; gap: 1rem; }
          .table-wrapper { overflow-x: auto; }
          .admin-table { min-width: 700px; }
        }

      `}</style>
    </div>
  );
}

function StatCard({ title, value, change, icon, color }) {
  return (
    <div className="glass-card stat-card">
      <div className="stat-header">
        <div className="stat-icon-box" style={{ background: `${color}15`, color: color }}>
          {icon}
        </div>
        <div className="stat-change" style={{ color: change.includes('+') ? '#22C55E' : '#F59E0B' }}>
          {change}
        </div>
      </div>
      <div className="stat-content">
        <span className="stat-label">{title}</span>
        <h3 className="stat-value">{value}</h3>
      </div>
      <style jsx>{`
        .stat-card { padding: 2rem; display: flex; flex-direction: column; gap: 1.5rem; border: 1px solid var(--card-border); }
        .stat-header { display: flex; justify-content: space-between; align-items: center; }
        .stat-icon-box { width: 50px; height: 50px; border-radius: 14px; display: flex; align-items: center; justify-content: center; }
        :global(.stat-icon-box svg) { width: 24px; height: 24px; }
        .stat-change { font-size: 0.85rem; font-weight: 700; background: #F8FAFC; padding: 0.4rem 0.8rem; border-radius: 100px; }
        .stat-label { color: #64748b; font-size: 0.95rem; font-weight: 500; }
        .stat-value { font-size: 1.8rem; font-weight: 800; color: #000; margin-top: 0.2rem; }
      `}</style>
    </div>
  );
}
