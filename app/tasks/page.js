'use client';

import { useState, useEffect } from 'react';
import { db, auth } from '../../lib/firebase';
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp, getDoc, doc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { Search, Plus, Calendar, DollarSign, User, Briefcase, ChevronRight, Loader2, X, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

const CATEGORIES = [
  'All Categories',
  'Graphic Design',
  'Web & UI/UX Design',
  'App & Web Dev',
  'Architecture & 3D',
  'Digital Art & Content'
];

const MOCK_TASKS = [
  {
    id: 'mock_task_1',
    title: 'Minimalist Tech Logo Design',
    category: 'Graphic Design',
    description: 'We need a modern, sleek logo for a new fintech startup based in Nairobi. The brand name is "FinFlow". Deliverables should include vector formats (AI, EPS) and high-res PNG/JPG previews.',
    budget: 3500,
    clientName: 'Nairobi Fintech Ltd',
    deadline: '2026-08-25',
    submissionsCount: 2,
    createdAt: { toDate: () => new Date(Date.now() - 3600000 * 2) }
  },
  {
    id: 'mock_task_2',
    title: 'Next.js Landing Page Development',
    category: 'Web & UI/UX Design',
    description: 'Looking for a developer to convert our Figma design into a responsive Next.js landing page. Clean code, fast performance, and mobile responsive are key. We will host on Vercel.',
    budget: 15000,
    clientName: 'Keja Rentals',
    deadline: '2026-09-02',
    submissionsCount: 1,
    createdAt: { toDate: () => new Date(Date.now() - 3600000 * 5) }
  },
  {
    id: 'mock_task_3',
    title: '3D Render of modern 4-Bedroom Villa',
    category: 'Architecture & 3D',
    description: 'Need interior and exterior 3D photorealistic renderings for a modern residential villa in Runda. Architectural drawings/floorplans will be provided.',
    budget: 25000,
    clientName: 'Alpha Developers',
    deadline: '2026-08-30',
    submissionsCount: 0,
    createdAt: { toDate: () => new Date(Date.now() - 3600000 * 12) }
  }
];

export default function TasksPage() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  
  // Post Task Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCategory, setNewCategory] = useState('Graphic Design');
  const [newBudget, setNewBudget] = useState('');
  const [newDeadline, setNewDeadline] = useState('');

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
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTasks(list);
    } catch (err) {
      console.error("Error fetching tasks:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handlePostTask = async (e) => {
    e.preventDefault();
    if (!user) {
      window.location.href = '/login';
      return;
    }
    
    if (!newTitle || !newDesc || !newBudget || !newDeadline) {
      setErrorMsg('Please fill in all required fields.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      await addDoc(collection(db, 'tasks'), {
        title: newTitle,
        description: newDesc,
        category: newCategory,
        budget: parseFloat(newBudget),
        deadline: newDeadline,
        clientUid: user.uid,
        clientName: userData?.name || user.displayName || user.email.split('@')[0],
        clientEmail: user.email,
        status: 'open',
        submissionsCount: 0,
        createdAt: serverTimestamp()
      });

      // Reset Form & Close Modal
      setNewTitle('');
      setNewDesc('');
      setNewCategory('Graphic Design');
      setNewBudget('');
      setNewDeadline('');
      setIsModalOpen(false);
      
      // Refresh Task List
      fetchTasks();
    } catch (err) {
      console.error("Error posting task:", err);
      setErrorMsg('Failed to post task. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter tasks client-side based on category & search query
  const displayTasks = tasks.length > 0 ? tasks : MOCK_TASKS;
  const filteredTasks = displayTasks.filter(task => {
    const matchesCategory = selectedCategory === 'All Categories' || task.category === selectedCategory;
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          task.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          task.clientName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="tasks-container">
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

      {/* Hero Header */}
      <header className="tasks-hero">
        <span className="badge">Task Marketplace</span>
        <h1>Kenyan Creator Briefs &amp; Gigs</h1>
        <p>Explore briefs posted by clients, upload your completed works, and get paid instantly.</p>
        
        <div className="hero-actions">
          {user ? (
            <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
              <Plus size={18} /> Post a Task Brief
            </button>
          ) : (
            <Link href="/login">
              <button className="btn-primary">
                Post a Brief
              </button>
            </Link>
          )}
        </div>
      </header>

      {/* Search & Filter Controls */}
      <section className="controls-section glass-card">
        <div className="search-bar">
          <Search size={20} className="search-icon" />
          <input 
            type="text" 
            placeholder="Search by keywords, tasks, or clients..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="categories-list">
          {CATEGORIES.map((cat) => (
            <button 
              key={cat} 
              className={`category-filter-btn ${selectedCategory === cat ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </section>

      {/* Gigs List Section */}
      <section className="gigs-section">
        {loading ? (
          <div className="loading-state">
            <Loader2 className="spin" size={36} />
            <p>Fetching active briefs...</p>
          </div>
        ) : filteredTasks.length > 0 ? (
          <div className="gigs-grid">
            {filteredTasks.map((task) => (
              <div key={task.id} className="gig-card glass-card">
                <div className="gig-card-header">
                  <span className="gig-category">{task.category}</span>
                  <span className="gig-budget">KSh {parseFloat(task.budget).toLocaleString()}</span>
                </div>
                <h3>{task.title}</h3>
                <p className="gig-desc">{task.description}</p>
                
                <div className="gig-meta">
                  <div className="meta-item">
                    <User size={14} />
                    <span>{task.clientName}</span>
                  </div>
                  <div className="meta-item">
                    <Calendar size={14} />
                    <span>Due: {task.deadline}</span>
                  </div>
                </div>
                
                <div className="gig-footer">
                  <span className="submissions-count">
                    {task.submissionsCount || 0} deliverable(s) submitted
                  </span>
                  <Link href={`/tasks/${task.id}`} style={{ textDecoration: 'none' }}>
                    <button className="btn-text-btn">
                      View Details &amp; Apply <ChevronRight size={16} />
                    </button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state glass-card">
            <Briefcase size={48} className="empty-icon" />
            <h3>No Active Briefs Found</h3>
            <p>We couldn't find any task briefs matching your filters. Try checking different keywords or category.</p>
          </div>
        )}
      </section>

      {/* Post Task Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="modal-card glass-card"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3>Post a Task Brief</h3>
                <button className="modal-close-btn" onClick={() => setIsModalOpen(false)}>
                  <X size={20} />
                </button>
              </div>
              
              {errorMsg && (
                <div className="modal-error">
                  <AlertCircle size={18} />
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handlePostTask}>
                <div className="input-group">
                  <label>Project Title / What do you need?</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Modern Landing Page Figma Mockup" 
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="input-group">
                  <label>Task Description &amp; Requirements</label>
                  <textarea 
                    rows={4}
                    placeholder="Explain the brief in detail. Mention deliverables, dimensions, preferred colors, or tech stack..." 
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    required
                  />
                </div>

                <div className="modal-row">
                  <div className="input-group" style={{ flex: 1 }}>
                    <label>Category</label>
                    <select 
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                    >
                      {CATEGORIES.slice(1).map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div className="input-group" style={{ flex: 1 }}>
                    <label>Budget (KSh)</label>
                    <input 
                      type="number" 
                      placeholder="e.g. 5000" 
                      value={newBudget}
                      onChange={(e) => setNewBudget(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="input-group">
                  <label>Deadline Date</label>
                  <input 
                    type="date" 
                    value={newDeadline}
                    onChange={(e) => setNewDeadline(e.target.value)}
                    required
                  />
                </div>

                <div className="modal-actions">
                  <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={isSubmitting}>
                    {isSubmitting ? 'Posting brief...' : 'Post Brief Now'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style jsx>{`
        .tasks-container {
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

        .tasks-hero {
          text-align: center;
          padding: 4rem 0 3rem;
          max-width: 800px;
          margin: 0 auto;
        }

        .tasks-hero h1 {
          font-size: 3rem;
          font-weight: 900;
          margin-bottom: 1rem;
          background: linear-gradient(to right, var(--primary), #000);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .tasks-hero p {
          font-size: 1.15rem;
          color: #475569;
          margin-bottom: 2rem;
        }

        .badge {
          background: #F0FDF4;
          color: #166534;
          padding: 0.5rem 1rem;
          border-radius: 100px;
          font-size: 0.9rem;
          font-weight: 600;
          border: 1px solid rgba(22, 101, 52, 0.1);
          display: inline-block;
          margin-bottom: 1.5rem;
        }

        .hero-actions {
          display: flex;
          justify-content: center;
        }

        .controls-section {
          padding: 1.5rem;
          margin-bottom: 3rem;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .search-bar {
          display: flex;
          align-items: center;
          background: #F8FAFC;
          border: 1px solid var(--card-border);
          border-radius: 12px;
          padding: 0.2rem 1rem;
          width: 100%;
        }

        .search-icon {
          color: #94a3b8;
          margin-right: 0.8rem;
        }

        .search-bar input {
          flex: 1;
          background: transparent;
          border: none;
          padding: 0.8rem 0;
          font-size: 1rem;
          outline: none;
          color: var(--foreground);
        }

        .categories-list {
          display: flex;
          gap: 0.6rem;
          flex-wrap: wrap;
        }

        .category-filter-btn {
          background: white;
          border: 1px solid var(--glass-border);
          padding: 0.5rem 1.1rem;
          border-radius: 100px;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          color: #475569;
        }

        .category-filter-btn:hover {
          color: var(--primary);
          border-color: var(--primary);
        }

        .category-filter-btn.active {
          background: var(--primary);
          color: white;
          border-color: var(--primary);
          box-shadow: 0 4px 12px var(--primary-glow);
        }

        .gigs-section {
          min-height: 300px;
        }

        .gigs-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 2rem;
        }

        .gig-card {
          display: flex;
          flex-direction: column;
          padding: 2rem;
          transition: all 0.3s ease;
          position: relative;
        }

        .gig-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 12px 25px rgba(0,0,0,0.08);
          border-color: var(--primary);
        }

        .gig-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.2rem;
        }

        .gig-category {
          background: var(--primary-glow);
          color: var(--primary);
          padding: 0.3rem 0.8rem;
          border-radius: 100px;
          font-size: 0.75rem;
          font-weight: 700;
        }

        .gig-budget {
          font-size: 1.25rem;
          font-weight: 850;
          color: var(--primary);
        }

        .gig-card h3 {
          font-size: 1.3rem;
          font-weight: 800;
          margin-bottom: 1rem;
          line-height: 1.4;
        }

        .gig-desc {
          color: #64748b;
          font-size: 0.92rem;
          line-height: 1.5;
          margin-bottom: 1.5rem;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
          flex: 1;
        }

        .gig-meta {
          display: flex;
          gap: 1.5rem;
          font-size: 0.85rem;
          color: #64748b;
          border-top: 1px solid rgba(0,0,0,0.05);
          padding: 1rem 0;
          margin-bottom: 0.5rem;
        }

        .meta-item {
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }

        .gig-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: auto;
          padding-top: 0.5rem;
        }

        .submissions-count {
          font-size: 0.8rem;
          color: #94a3b8;
          font-weight: 600;
        }

        .btn-text-btn {
          background: transparent;
          border: none;
          color: var(--primary);
          font-weight: 700;
          font-size: 0.88rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.2rem;
          transition: opacity 0.2s;
        }

        .btn-text-btn:hover {
          opacity: 0.7;
        }

        .loading-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 5rem 0;
          color: #64748b;
          gap: 1rem;
        }

        .empty-state {
          text-align: center;
          padding: 5rem 2rem;
        }

        .empty-icon {
          color: #cbd5e1;
          margin-bottom: 1.5rem;
        }

        .empty-state h3 {
          font-size: 1.4rem;
          font-weight: 800;
          margin-bottom: 0.5rem;
        }

        .empty-state p {
          color: #64748b;
          max-width: 450px;
          margin: 0 auto;
          font-size: 0.95rem;
          line-height: 1.5;
        }

        /* Modal styling */
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

        .modal-card {
          width: 580px;
          max-height: 90vh;
          overflow-y: auto;
          padding: 2.5rem;
          position: relative;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
        }

        .modal-header h3 {
          font-size: 1.5rem;
          font-weight: 800;
        }

        .modal-close-btn {
          background: transparent;
          border: none;
          cursor: pointer;
          color: #64748b;
          padding: 0.3rem;
          border-radius: 8px;
          transition: background 0.2s;
        }

        .modal-close-btn:hover {
          background: rgba(0,0,0,0.05);
        }

        .modal-error {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: rgba(248, 113, 113, 0.1);
          border: 1px solid rgba(248, 113, 113, 0.3);
          color: #f87171;
          padding: 0.8rem 1rem;
          border-radius: 10px;
          margin-bottom: 1.5rem;
          font-size: 0.9rem;
        }

        .modal-row {
          display: flex;
          gap: 1.5rem;
        }

        .input-group {
          margin-bottom: 1.5rem;
        }

        .input-group label {
          display: block;
          margin-bottom: 0.5rem;
          font-size: 0.88rem;
          font-weight: 600;
          color: #475569;
        }

        .input-group input, .input-group select, .input-group textarea {
          width: 100%;
          background: #F8FAFC;
          border: 1px solid var(--card-border);
          padding: 0.85rem;
          border-radius: 8px;
          color: var(--foreground);
          font-family: inherit;
          outline: none;
        }

        .input-group input:focus, .input-group select:focus, .input-group textarea:focus {
          border-color: var(--primary);
        }

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 1rem;
          margin-top: 2rem;
        }

        /* Responsive Breakpoints */
        @media (max-width: 1024px) {
          .gigs-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 768px) {
          .tasks-hero h1 {
            font-size: 2.2rem;
          }
          .tasks-hero p {
            font-size: 1rem;
          }
          .gigs-grid {
            grid-template-columns: 1fr;
            gap: 1.5rem;
          }
          .controls-section {
            padding: 1rem;
          }
          .modal-card {
            width: 95%;
            padding: 1.5rem;
          }
          .modal-row {
            flex-direction: column;
            gap: 0;
          }
          .modal-actions {
            flex-direction: column-reverse;
            gap: 0.75rem;
          }
          .modal-actions button {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
}
