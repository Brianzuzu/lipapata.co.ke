'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '../../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { usePathname } from 'next/navigation';
import { 
  Users, 
  FileText, 
  Banknote, 
  Layout, 
  Settings, 
  LogOut, 
  Image as ImageIcon,
  Menu,
  X,
  Loader2,
  ShieldAlert
} from 'lucide-react';
import Link from 'next/link';

export default function AdminLayout({ children }) {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists() && userDoc.data().role === 'admin') {
          setIsAdmin(true);
        } else {
          router.push('/');
        }
      } else {
        router.push('/login');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
        <Loader2 className="spin" size={40} color="var(--primary)" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#000', color: 'white', textAlign: 'center', padding: '2rem' }}>
        <ShieldAlert size={60} color="#ef4444" style={{ marginBottom: '1.5rem' }} />
        <h1>Access Denied</h1>
        <p style={{ opacity: 0.6, marginTop: '1rem' }}>You do not have administrative privileges to view this section.</p>
        <button 
          onClick={() => router.push('/')}
          className="btn-primary"
          style={{ marginTop: '2rem', padding: '0.8rem 2rem' }}
        >
          Return Home
        </button>
      </div>
    );
  }

  return (
    <div className="admin-root">
      <div className="admin-layout">
        {/* Sidebar for Desktop */}
        <aside className={`sidebar ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
          <div className="sidebar-brand">
            <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
              <img src="/logo-v2.png" alt="Lipapata Logo" style={{ width: '60px', height: '60px', objectFit: 'contain', mixBlendMode: 'darken' }} />
              <div className="logo-text">Lipapata<span>.</span></div>
            </Link>
            <button className="mobile-close" onClick={() => setIsMobileMenuOpen(false)}>
              <X size={24} />
            </button>
          </div>

          <nav className="sidebar-nav">
            <Link href="/admin" onClick={() => setIsMobileMenuOpen(false)}>
              <button className={`nav-item ${pathname === '/admin' ? 'active' : ''}`}><Layout size={20} /> Overview</button>
            </Link>
            <Link href="/admin/users" onClick={() => setIsMobileMenuOpen(false)}>
              <button className={`nav-item ${pathname === '/admin/users' ? 'active' : ''}`}><Users size={20} /> Creators</button>
            </Link>
            <Link href="/admin/projects" onClick={() => setIsMobileMenuOpen(false)}>
              <button className={`nav-item ${pathname === '/admin/projects' ? 'active' : ''}`}><FileText size={20} /> Assets</button>
            </Link>
            <Link href="/admin/transactions" onClick={() => setIsMobileMenuOpen(false)}>
              <button className={`nav-item ${pathname === '/admin/transactions' ? 'active' : ''}`}><Banknote size={20} /> Payments</button>
            </Link>
            <Link href="/admin/withdrawals" onClick={() => setIsMobileMenuOpen(false)}>
              <button className={`nav-item ${pathname === '/admin/withdrawals' ? 'active' : ''}`}><Banknote size={20} /> Withdrawals</button>
            </Link>
            <Link href="/admin/ads" onClick={() => setIsMobileMenuOpen(false)}>
              <button className={`nav-item ${pathname === '/admin/ads' ? 'active' : ''}`}><ImageIcon size={20} /> Slide Ads</button>
            </Link>
            <div className="nav-divider" />
            <Link href="/admin/settings" onClick={() => setIsMobileMenuOpen(false)}>
              <button className="nav-item"><Settings size={20} /> Settings</button>
            </Link>
            <button className="nav-item logout" onClick={() => auth.signOut()}><LogOut size={20} /> Logout</button>
          </nav>
        </aside>

        {/* Mobile Header */}
        <header className="mobile-header">
          <Link href="/">
            <img src="/logo-v2.png" alt="Logo" style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
          </Link>
          <button className="menu-toggle" onClick={() => setIsMobileMenuOpen(true)}>
            <Menu size={24} />
          </button>
        </header>

        <main className="main-content">
          {children}
        </main>
      </div>

      <style jsx global>{`
        .admin-root {
          min-height: 100vh;
          background: #F8FAFC;
        }

        .admin-layout {
          display: grid;
          grid-template-columns: 280px 1fr;
          min-height: 100vh;
        }

        .sidebar {
          background: #FFFFFF;
          border-right: 1px solid rgba(0,0,0,0.05);
          padding: 2rem;
          display: flex;
          flex-direction: column;
          gap: 2.5rem;
          position: sticky;
          top: 0;
          height: 100vh;
          z-index: 100;
          transition: transform 0.3s ease;
        }

        .sidebar-brand { display: flex; align-items: center; justify-content: space-between; }
        .mobile-close { display: none; background: none; border: none; cursor: pointer; opacity: 0.5; }
        
        .logo-text { font-size: 1.2rem; font-weight: 800; color: #000; }
        .logo-text span { color: var(--primary); }

        .sidebar-nav { display: flex; flex-direction: column; gap: 0.4rem; }
        .nav-item {
          display: flex;
          align-items: center;
          gap: 0.8rem;
          padding: 0.7rem 1rem;
          border: none;
          background: transparent;
          color: #475569;
          font-weight: 600;
          border-radius: 10px;
          cursor: pointer;
          transition: 0.2s;
          width: 100%;
          text-align: left;
          font-size: 0.9rem;
        }

        .nav-item:hover { background: #F8FAFC; color: var(--primary); }
        .nav-item.active { background: #F0FDF4; color: var(--primary); }
        .nav-divider { height: 1px; background: rgba(0,0,0,0.05); margin: 0.8rem 0; }
        .logout:hover { background: #FEF2F2; color: #EF4444; }

        .mobile-header {
          display: none;
          padding: 1rem 1.5rem;
          background: #fff;
          border-bottom: 1px solid rgba(0,0,0,0.05);
          justify-content: space-between;
          align-items: center;
          position: sticky;
          top: 0;
          z-index: 90;
        }

        .menu-toggle { background: none; border: none; cursor: pointer; }

        .main-content {
          padding: 3rem;
          max-width: 1400px;
          width: 100%;
          margin: 0 auto;
        }

        @media (max-width: 1024px) {
          .admin-layout { grid-template-columns: 1fr; }
          .sidebar {
            position: fixed;
            left: 0;
            top: 0;
            bottom: 0;
            width: 280px;
            transform: translateX(-100%);
            box-shadow: 20px 0 50px rgba(0,0,0,0.1);
          }
          .sidebar.mobile-open { transform: translateX(0); }
          .mobile-close { display: block; }
          .mobile-header { display: flex; }
          .main-content { padding: 1.5rem; }
        }

        /* Generic table responsiveness */
        .glass-card {
          background: #fff;
          border-radius: 16px;
          border: 1px solid rgba(0,0,0,0.05);
          box-shadow: 0 4px 20px rgba(0,0,0,0.02);
          overflow: hidden;
        }

        .table-container {
          width: 100%;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }

        .admin-table {
          min-width: 800px;
        }
      `}</style>
    </div>
  );
}

function SidebarLink({ href, icon, label, active }) {
  return (
    <Link href={href} className={`sidebar-btn ${active ? 'active' : ''}`}>
      {icon} {label}
    </Link>
  );
}
