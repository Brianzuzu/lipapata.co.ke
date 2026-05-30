'use client';

import { ShieldCheck, Upload, CreditCard, ChevronRight, Menu, X } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { AnimatePresence, motion } from 'framer-motion';

export default function Home() {
  const [ads, setAds] = useState([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const fetchAds = async () => {
      try {
        const q = query(collection(db, 'ads'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        setAds(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        console.error("Error fetching ads:", err);
      }
    };
    fetchAds();
  }, []);

  useEffect(() => {
    if (ads.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % ads.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [ads]);

  return (
    <main className="container">
      {/* Navigation */}
      <nav className="nav">
        <Link href="/" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="logo-container" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <img src="/logo-v2.png" alt="Lipapata Logo" style={{ width: '80px', height: '80px', objectFit: 'contain', mixBlendMode: 'darken' }} />
            <div className="logo">Lipapata<span>.</span></div>
          </div>
        </Link>
        {/* Desktop links */}
        <div className="nav-links">
          <a href="#features">Features</a>
          <a href="#how-it-works">How it Works</a>
          <Link href="/login" className="login-link">Login</Link>
          <Link href="/dashboard">
            <button className="btn-primary">Get Started</button>
          </Link>
        </div>
        {/* Mobile hamburger */}
        <button className="hamburger" onClick={() => setMobileMenuOpen(true)} aria-label="Open menu">
          <Menu size={24} />
        </button>
      </nav>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="mobile-overlay" onClick={() => setMobileMenuOpen(false)}>
          <motion.div
            className="mobile-menu"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25 }}
            onClick={e => e.stopPropagation()}
          >
            <button className="mobile-close" onClick={() => setMobileMenuOpen(false)} aria-label="Close menu">
              <X size={24} />
            </button>
            <nav className="mobile-nav-links">
              <a href="#features" onClick={() => setMobileMenuOpen(false)}>Features</a>
              <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)}>How it Works</a>
              <Link href="/login" onClick={() => setMobileMenuOpen(false)} style={{ color: 'var(--primary)', fontWeight: 800 }}>Login</Link>
              <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)}>
                <button className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '1rem' }}>Get Started <ChevronRight size={18} /></button>
              </Link>
            </nav>
          </motion.div>
        </div>
      )}

      {/* Hero Section (Redesigned 3-Column Layout) */}
      <section className="hero-redesign">
        {/* Left Column: Promotion Slides */}
        <div className="hero-col-left">
          {ads.length > 0 && (
            <div className="promo-carousel">
              <AnimatePresence mode='wait'>
                <motion.div
                  key={ads[currentSlide].id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.5 }}
                  className="promo-slide-container"
                >
                  <a href={ads[currentSlide].linkUrl || '#'} target={ads[currentSlide].linkUrl ? "_blank" : "_self"}>
                    <img 
                      src={ads[currentSlide].imageUrl} 
                      alt={ads[currentSlide].title || "Promotion"} 
                      className="promo-image-tag" 
                    />
                  </a>
                </motion.div>
              </AnimatePresence>
              {ads.length > 1 && (
                <div className="promo-dots">
                  {ads.map((_, i) => (
                    <div 
                      key={i} 
                      className={`promo-dot ${i === currentSlide ? 'active' : ''}`}
                      onClick={() => setCurrentSlide(i)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Center Column: Main Content */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="hero-col-center"
        >
          <span className="badge">Helping creators get paid by their clients</span>
          <h1>Your Work. <span>Your Pay.</span> Simplified.</h1>
          <p>
            The premium platform for creators to securely share assets, manage payments, and ensure instant delivery.
          </p>
          <div className="hero-actions">
            <Link href="/dashboard">
              <button className="btn-primary">Start Now <ChevronRight size={18} /></button>
            </Link>
          </div>
        </motion.div>

        {/* Right Column: Original Preview Card */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="hero-col-right"
        >
          <div className="preview-card glass-card">
            <div className="card-header">
              <div className="status-dot"></div>
              <span>Project_Final_V2.mp4</span>
            </div>
            <div className="card-body">
              <div className="watermark-overlay">PREVIEW ONLY</div>
              <div className="placeholder-content"></div>
            </div>
            <div className="card-footer">
              <div className="price">KSh 700</div>
              <button className="btn-pay">Unlock Now</button>
            </div>
            <div style={{ marginTop: '1rem', textAlign: 'center' }}>
              <Link href="/portfolio/demo" className="btn-text" style={{ fontSize: '0.85rem', opacity: 0.7 }}>
                More from this creator →
              </Link>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section id="features" className="features">
        <div className="feature-grid">
          <FeatureCard 
            icon={<ShieldCheck className="icon-primary" />}
            title="Smart Watermarking"
            description="Automatically protect your videos and designs with custom watermarks before payment."
          />
          <FeatureCard 
            icon={<Upload className="icon-primary" />}
            title="Fast Uploads"
            description="Upload large assets and share a unique link with your clients in seconds."
          />
          <FeatureCard 
            icon={<CreditCard className="icon-primary" />}
            title="Local Payments"
            description="Integrated with M-Pesa and global payments for seamless transactions."
          />
        </div>
      </section>

      <style jsx>{`
        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 1.5rem;
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
          z-index: 1000;
          box-shadow: 0 10px 30px rgba(0,0,0,0.05);
          max-width: 1200px;
          transition: all 0.3s ease;
        }

        .hamburger {
          display: none;
          background: none;
          border: none;
          cursor: pointer;
          padding: 0.5rem;
          color: var(--foreground);
          border-radius: 8px;
          transition: background 0.2s;
        }

        .hamburger:hover { background: rgba(0,0,0,0.05); }

        .mobile-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.5);
          z-index: 2000;
          backdrop-filter: blur(4px);
        }

        .mobile-menu {
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          width: 80%;
          max-width: 320px;
          background: white;
          padding: 2rem 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
          box-shadow: -20px 0 60px rgba(0,0,0,0.15);
        }

        .mobile-close {
          align-self: flex-end;
          background: none;
          border: none;
          cursor: pointer;
          padding: 0.5rem;
          color: var(--foreground);
          border-radius: 8px;
          transition: background 0.2s;
          margin-bottom: 1rem;
        }

        .mobile-close:hover { background: rgba(0,0,0,0.05); }

        .mobile-nav-links {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .mobile-nav-links a {
          color: #1e293b;
          text-decoration: none;
          font-weight: 600;
          font-size: 1.1rem;
          padding: 0.8rem 0;
          border-bottom: 1px solid rgba(0,0,0,0.06);
        }

        .hero-redesign {
          display: grid;
          grid-template-columns: 1fr 1.5fr 1fr;
          gap: 2rem;
          align-items: center;
          padding: 4rem 0;
          min-height: 500px;
        }

        .hero-col-left, .hero-col-right { width: 100%; }
        .hero-col-center { text-align: center; padding: 0 2rem; }

        .promo-carousel {
          position: relative;
          border-radius: 20px;
          overflow: hidden;
          background: #f1f5f9;
          box-shadow: 0 20px 40px rgba(0,0,0,0.1);
          aspect-ratio: 4/5;
          border: 1px solid rgba(0,0,0,0.05);
        }

        .promo-slide-container { width: 100%; height: 100%; display: flex; }
        .promo-slide-container a { display: block; width: 100%; height: 100%; flex: 1; }
        
        .promo-image-tag { 
          width: 100%; 
          height: 100%; 
          object-fit: cover;
          display: block;
          cursor: pointer;
        }

        .promo-dots {
          position: absolute;
          bottom: 15px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          gap: 0.4rem;
          z-index: 10;
        }

        .promo-dot { width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,0.3); cursor: pointer; transition: 0.3s; }
        .promo-dot.active { background: var(--primary); width: 15px; border-radius: 3px; }

        .hero-col-center h1 {
          font-size: 3.5rem;
          line-height: 1.1;
          margin-bottom: 1.5rem;
          font-weight: 900;
        }

        .hero-col-center h1 span {
          background: linear-gradient(to right, #000, var(--primary));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .hero-col-center p {
          font-size: 1.1rem;
          color: #475569;
          margin-bottom: 2rem;
        }

        .hero-actions { justify-content: center; display: flex; }

        .logo-container { transition: transform 0.3s ease; cursor: pointer; }
        .logo-container:hover { transform: scale(1.05); }

        .logo {
          font-size: 1.8rem;
          font-weight: 800;
          color: #000;
        }

        .logo span {
          color: var(--primary);
          display: inline-block;
          animation: pulse-dot 2s infinite;
        }

        @keyframes pulse-dot {
          0% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.3); }
          100% { opacity: 1; transform: scale(1); }
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
          position: relative;
          padding: 0.5rem 0;
          transition: color 0.3s ease;
        }

        .nav-links a::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          width: 0;
          height: 2px;
          background: var(--primary);
          transition: width 0.3s ease;
          border-radius: 2px;
        }

        .nav-links a:hover { color: var(--primary); }
        .nav-links a:hover::after { width: 100%; }

        .login-link {
          color: var(--primary) !important;
          font-weight: 800 !important;
          text-decoration: none;
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

        .preview-card {
          position: relative;
          width: 100%;
          overflow: hidden;
        }

        .card-header {
          display: flex;
          align-items: center;
          gap: 0.8rem;
          margin-bottom: 1.5rem;
          font-size: 0.9rem;
          opacity: 0.8;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          background: var(--primary);
          border-radius: 50%;
          box-shadow: 0 0 10px var(--primary);
          flex-shrink: 0;
        }

        .card-body {
          aspect-ratio: 16/9;
          background: #111111;
          border-radius: 12px;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 1.5rem;
          border: 1px solid rgba(0,0,0,0.1);
          overflow: hidden;
        }

        .watermark-overlay {
          position: absolute;
          font-weight: 900;
          font-size: 2rem;
          opacity: 0.1;
          transform: rotate(-30deg);
          pointer-events: none;
          color: #ffffff;
        }

        .card-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .price {
          font-size: 1.5rem;
          font-weight: 700;
        }

        .btn-pay {
          background: white;
          color: black;
          padding: 0.6rem 1.2rem;
          border-radius: 8px;
          font-weight: 700;
          border: none;
          cursor: pointer;
        }

        .features {
          padding: 4rem 0;
        }

        .feature-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 2rem;
        }

        /* ── Tablet (≤1024px) ─────────────────── */
        @media (max-width: 1024px) {
          .nav-links { display: none; }
          .hamburger { display: flex; }

          .hero-redesign { 
            grid-template-columns: 1fr; 
            padding: 2rem 0;
            text-align: center;
            gap: 2.5rem;
          }
          .hero-col-left { order: 1; max-width: 360px; margin: 0 auto; }
          .hero-col-center { order: 2; padding: 0; }
          .hero-col-right { order: 3; max-width: 360px; margin: 0 auto; }

          .hero-col-center h1 { font-size: 2.6rem; }
          .hero-col-center p { font-size: 1rem; }
          
          .feature-grid { grid-template-columns: repeat(2, 1fr); }
        }

        /* ── Mobile (≤600px) ─────────────────── */
        @media (max-width: 600px) {
          .nav {
            padding: 0.6rem 1rem;
            margin: 0.5rem;
            top: 0.5rem;
            border-radius: 16px;
          }

          .logo { font-size: 1.4rem; }

          .hero-redesign {
            padding: 1.5rem 0;
            gap: 2rem;
          }

          .hero-col-center h1 { font-size: 2rem; }
          .hero-col-center p { font-size: 0.95rem; }
          .badge { font-size: 0.8rem; padding: 0.4rem 0.8rem; }

          .feature-grid { grid-template-columns: 1fr; }

          .features { padding: 2.5rem 0; }
        }
      `}</style>
    </main>
  );
}

function FeatureCard({ icon, title, description }) {
  return (
    <div className="glass-card feature-card">
      <div className="feature-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      <style jsx>{`
        .feature-card {
          transition: transform 0.3s ease;
        }
        .feature-card:hover {
          transform: translateY(-10px);
          border-color: var(--primary);
        }
        .feature-icon {
          margin-bottom: 1.5rem;
        }
        :global(.icon-primary) {
          color: var(--primary);
          width: 32px;
          height: 32px;
        }
        h3 {
          margin-bottom: 1rem;
          font-size: 1.4rem;
        }
        p {
          color: #475569;
          line-height: 1.6;
        }
      `}</style>
    </div>
  );
}
