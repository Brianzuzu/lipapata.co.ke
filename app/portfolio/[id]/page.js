'use client';

import { useState, useEffect } from 'react';
import { db } from '../../../lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import Link from 'next/link';
import { Loader2, ArrowRight, Globe, Image, Film, FileText, Share2 } from 'lucide-react';

const TwitterIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"></path>
  </svg>
);

const InstagramIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
  </svg>
);

export default function CreatorPortfolio({ params }) {
  const { id } = params;
  const [creator, setCreator] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPortfolio = async () => {
      try {
        const creatorDoc = await getDoc(doc(db, 'users', id));
        if (creatorDoc.exists()) {
          setCreator(creatorDoc.data());
        }

        const q = query(
          collection(db, 'projects'),
          where('uid', '==', id)
        );
        const snapshot = await getDocs(q);
        const projectList = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}))
                            .sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0));
        setProjects(projectList);
      } catch (err) {
        console.error('Error fetching portfolio:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchPortfolio();
  }, [id]);

  if (loading) {
    return (
      <div className="flex-center" style={{ height: '100vh' }}>
        <Loader2 className="spin" size={40} />
      </div>
    );
  }

  if (!creator) {
    return (
      <div className="flex-center" style={{ height: '100vh', flexDirection: 'column' }}>
        <h1>Creator not found</h1>
        <Link href="/" className="btn-primary mt-4">Go Home</Link>
      </div>
    );
  }

  return (
    <div className="portfolio-container">
      {/* Cover Photo */}
      <div 
        className="cover-photo" 
        style={{ 
          backgroundImage: `url(${creator.coverPhotoUrl || 'https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&q=80&w=2000'})` 
        }}
      >
        <div className="cover-overlay"></div>
      </div>

      <div className="portfolio-content">
        {/* Profile Info */}
        <div className="profile-section glass-card">
          <div className="profile-pic">
            {creator.photoURL ? (
              <img src={creator.photoURL} alt={creator.name || 'Creator'} />
            ) : (
              <div className="avatar-placeholder">{(creator.name || 'C').charAt(0)}</div>
            )}
          </div>
          <div className="profile-details">
            <h1>{creator.name || 'Creator'}</h1>
            <p className="bio">{creator.bio || 'Digital creator making awesome things.'}</p>
            <div className="social-links">
              {creator.website && (
                <a href={creator.website} target="_blank" rel="noreferrer" className="social-btn">
                  <Globe size={18} /> Website
                </a>
              )}
              {creator.twitter && (
                <a href={creator.twitter} target="_blank" rel="noreferrer" className="social-btn">
                  <TwitterIcon size={18} /> Twitter
                </a>
              )}
              {creator.instagram && (
                <a href={creator.instagram} target="_blank" rel="noreferrer" className="social-btn">
                  <InstagramIcon size={18} /> Instagram
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Projects Grid */}
        <div className="projects-section">
          <h2 style={{ marginBottom: '2rem' }}>Digital Products</h2>
          <div className="projects-grid">
            {projects.length > 0 ? (
              projects.map(p => (
                <Link href={`/p/${p.id}`} key={p.id} className="project-card glass-card">
                  <div className="project-type-icon">
                    {p.resourceType === 'video' ? <Film size={20} /> : p.resourceType === 'image' ? <Image size={20} /> : <FileText size={20} />}
                  </div>
                  <h3>{p.title || p.fileName}</h3>
                  <div className="project-meta">
                    <span className="price">
                      {p.isPWYW ? `From KSh ${parseFloat(p.price || 0).toLocaleString()}` : `KSh ${parseFloat(p.price || 0).toLocaleString()}`}
                    </span>
                    <span className="arrow"><ArrowRight size={16} /></span>
                  </div>
                </Link>
              ))
            ) : (
              <div className="empty-state">No products available yet.</div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .flex-center {
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        
        .portfolio-container {
          min-height: 100vh;
          background: var(--background);
        }
        
        .cover-photo {
          height: 350px;
          background-size: cover;
          background-position: center;
          position: relative;
        }
        
        .cover-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(to bottom, rgba(0,0,0,0.1), var(--background));
        }
        
        .portfolio-content {
          max-width: 1000px;
          margin: -100px auto 0;
          padding: 0 2rem 4rem;
          position: relative;
          z-index: 10;
        }
        
        .profile-section {
          padding: 2.5rem;
          display: flex;
          align-items: center;
          gap: 2.5rem;
          margin-bottom: 4rem;
        }
        
        .profile-pic {
          width: 150px;
          height: 150px;
          border-radius: 50%;
          border: 4px solid var(--background);
          overflow: hidden;
          background: var(--card-bg);
          box-shadow: 0 10px 30px rgba(0,0,0,0.1);
          flex-shrink: 0;
        }
        
        .profile-pic img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        
        .avatar-placeholder {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 4rem;
          font-weight: 800;
          color: var(--primary);
          background: var(--primary-glow);
        }
        
        .profile-details h1 {
          font-size: 2.5rem;
          margin-bottom: 0.5rem;
        }
        
        .bio {
          font-size: 1.1rem;
          opacity: 0.8;
          line-height: 1.6;
          margin-bottom: 1.5rem;
          max-width: 600px;
        }
        
        .social-links {
          display: flex;
          gap: 1rem;
        }
        
        .social-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.6rem 1.2rem;
          background: rgba(0,0,0,0.03);
          border: 1px solid var(--card-border);
          border-radius: 100px;
          text-decoration: none;
          color: var(--foreground);
          font-size: 0.9rem;
          font-weight: 600;
          transition: all 0.3s;
        }
        
        .social-btn:hover {
          background: var(--primary-glow);
          color: var(--primary);
          border-color: var(--primary);
          transform: translateY(-2px);
        }
        
        .projects-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 1.5rem;
        }
        
        .project-card {
          padding: 2rem;
          text-decoration: none;
          color: var(--foreground);
          transition: all 0.3s;
          display: flex;
          flex-direction: column;
        }
        
        .project-card:hover {
          transform: translateY(-5px);
          border-color: var(--primary);
          box-shadow: 0 20px 40px rgba(0,0,0,0.05);
        }
        
        .project-type-icon {
          width: 40px;
          height: 40px;
          background: var(--primary-glow);
          color: var(--primary);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 1.5rem;
        }
        
        .project-card h3 {
          font-size: 1.2rem;
          margin-bottom: 1rem;
          flex: 1;
        }
        
        .project-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 1rem;
          border-top: 1px solid var(--glass-border);
        }
        
        .price {
          font-weight: 700;
          color: var(--primary);
        }
        
        .arrow {
          opacity: 0.5;
          transition: opacity 0.3s;
        }
        
        .project-card:hover .arrow {
          opacity: 1;
          color: var(--primary);
        }
        
        @media (max-width: 768px) {
          .profile-section {
            flex-direction: column;
            text-align: center;
            gap: 1.5rem;
            padding: 2rem;
          }
          
          .social-links {
            justify-content: center;
            flex-wrap: wrap;
          }
        }
      `}</style>
    </div>
  );
}
