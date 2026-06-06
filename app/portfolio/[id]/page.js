'use client';

import { useState, useEffect } from 'react';
import { db } from '../../../lib/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { Loader2, Globe, Music, Film, FileText, Archive, ShoppingBag, Package, Image } from 'lucide-react';
import Link from 'next/link';

/* ─── Social icons ─── */
const TikTokIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.77a4.85 4.85 0 0 1-1.01-.08z"/>
  </svg>
);
const IGIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
  </svg>
);
const WhatsAppIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
  </svg>
);

/* ─── Type config ─── */
const TYPE = {
  video:   { icon: Film,    bg: '#fdf4ff', color: '#a855f7', border: '#e9d5ff', label: 'Video'  },
  audio:   { icon: Music,   bg: '#fff7ed', color: '#f97316', border: '#fed7aa', label: 'Audio'  },
  image:   { icon: Image,   bg: '#f0fdf4', color: '#22c55e', border: '#bbf7d0', label: 'Image'  },
  zip:     { icon: Archive, bg: '#eff6ff', color: '#3b82f6', border: '#bfdbfe', label: 'Bundle' },
  archive: { icon: Archive, bg: '#eff6ff', color: '#3b82f6', border: '#bfdbfe', label: 'Bundle' },
  file:    { icon: FileText,bg: '#f8fafc', color: '#64748b', border: '#e2e8f0', label: 'File'   },
};
const getType = (t) => TYPE[t] || TYPE.file;

/* ─── Product Card ─── */
function ProductCard({ p, index, creator }) {
  const t = getType(p.resourceType);
  const Icon = t.icon;
  const waMsg = `Hi! I'm interested in "${p.title || p.fileName}" on Lipapata.`;
  const waUrl = creator?.whatsapp ? `https://wa.me/${creator.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(waMsg)}` : null;

  return (
    <div className="pcard-wrap" style={{ animationDelay: `${index * 55}ms` }}>
      <Link href={`/p/${p.id}`} className="pcard">
      {/* Thumbnail */}
      <div className="pcard-thumb">
        {p.previewUrl ? (
          <img src={p.previewUrl} alt={p.title || p.fileName} />
        ) : (
          <div className="pcard-thumb-blank" style={{ background: t.bg }}>
            <Icon size={44} color={t.color} strokeWidth={1.5} />
          </div>
        )}
        {/* Hover overlay */}
        <div className="pcard-hover">
          <span className="pcard-cta">View &amp; Buy</span>
        </div>
        {/* Type chip */}
        <div className="pcard-chip" style={{ background: t.bg, color: t.color, border: `1px solid ${t.border}` }}>
          <Icon size={11} /> {t.label}
        </div>
        {/* Sales badge */}
        {p.sales > 0 && (
          <div className="pcard-sales-badge">
            <ShoppingBag size={10} /> {p.sales}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="pcard-body">
        <p className="pcard-title">{p.title || p.fileName}</p>
        <div className="pcard-footer">
          <span className="pcard-price">
            {p.isPWYW
              ? <><span style={{ fontSize: '0.7rem', fontWeight: 600, opacity: 0.6 }}>from </span>KSh {parseFloat(p.price || 0).toLocaleString()}</>
              : <>KSh {parseFloat(p.price || 0).toLocaleString()}</>}
          </span>
          <span className="pcard-arrow">→</span>
        </div>
      </div>
      </Link>
      {waUrl && (
        <a href={waUrl} target="_blank" rel="noreferrer" className="pcard-wa-btn">
          <WhatsAppIcon size={14} /> Ask about this product
        </a>
      )}
    </div>
  );
}

/* ─── Main page ─── */
export default function CreatorPortfolio({ params }) {
  const { id } = params;
  const [creator, setCreator]   = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('all');
  const [copied, setCopied]     = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const cdoc = await getDoc(doc(db, 'users', id));
        if (cdoc.exists()) setCreator(cdoc.data());
        const snap = await getDocs(query(collection(db, 'projects'), where('uid', '==', id)));
        setProjects(
          snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0))
        );
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [id]);

  const share = () => {
    if (navigator.share) navigator.share({ title: `${creator?.name}'s Portfolio`, url: window.location.href });
    else { navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };

  const types   = ['all', ...new Set(projects.map(p => p.resourceType || 'file'))];
  const visible = filter === 'all' ? projects : projects.filter(p => (p.resourceType || 'file') === filter);
  const totalSales = projects.reduce((s, p) => s + (p.sales || 0), 0);

  /* ── Loading ── */
  if (loading) return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', background: '#f8fafc' }}>
      <Loader2 size={36} style={{ animation: 'spin 1s linear infinite', color: '#22c55e' }} />
      <p style={{ color: '#94a3b8', fontSize: '0.9rem', fontFamily: 'Inter,sans-serif' }}>Loading portfolio…</p>
    </div>
  );

  /* ── Not found ── */
  if (!creator) return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', background: '#f8fafc', fontFamily: 'Inter,sans-serif' }}>
      <div style={{ fontSize: '3.5rem' }}>😕</div>
      <h2 style={{ color: '#0f172a', margin: 0 }}>Creator not found</h2>
      <Link href="/" style={{ background: '#22c55e', color: '#fff', padding: '0.7rem 1.5rem', borderRadius: '12px', textDecoration: 'none', fontWeight: 700 }}>Go Home</Link>
    </div>
  );

  return (
    <div className="pf-root">

      {/* ══ NAV ══ */}
      <nav className="pf-nav">
        <Link href="/" className="pf-nav-logo">
          <img src="/logo-v2.png" alt="Lipapata" />
          <span>Lipapata</span>
        </Link>
        <button className="pf-share-btn" onClick={share}>
          {copied ? '✓ Link Copied' : 'Share'}
        </button>
      </nav>

      {/* ══ HERO ══ */}
      <header className="pf-hero">
        <div className="pf-hero-blob pf-blob1" />
        <div className="pf-hero-blob pf-blob2" />

        <div className="pf-hero-inner">
          {/* Avatar */}
          <div className="pf-av-wrap">
            <div className="pf-av">
              {creator.photoURL
                ? <img src={creator.photoURL} alt={creator.name} />
                : <div className="pf-av-init">{(creator.name || 'C')[0]}</div>
              }
            </div>
          </div>

          <h1 className="pf-name">{creator.name || 'Creator'}</h1>
          <p className="pf-bio">{creator.bio || 'Digital creator making awesome things.'}</p>

          {/* Socials */}
          <div className="pf-socials">
            {creator.website  && <a href={creator.website}  target="_blank" rel="noreferrer" className="pf-pill"><Globe size={14}/> Website</a>}
            {creator.tiktok   && <a href={creator.tiktok}   target="_blank" rel="noreferrer" className="pf-pill pf-tt"><TikTokIcon size={14}/> TikTok</a>}
            {creator.instagram&& <a href={creator.instagram} target="_blank" rel="noreferrer" className="pf-pill pf-ig"><IGIcon size={14}/> Instagram</a>}
            {creator.whatsapp && <a href={`https://wa.me/${creator.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="pf-pill pf-wa"><WhatsAppIcon size={14}/> WhatsApp</a>}
          </div>

          {/* Stats */}
          <div className="pf-stats">
            <div className="pf-stat"><span className="pf-sval">{projects.length}</span><span className="pf-slbl">Products</span></div>
            <div className="pf-sdiv"/>
            <div className="pf-stat"><span className="pf-sval">{totalSales}</span><span className="pf-slbl">Sales</span></div>
            <div className="pf-sdiv"/>
            <div className="pf-stat"><span className="pf-sval">{[...new Set(projects.map(p=>p.resourceType))].filter(Boolean).length || 1}</span><span className="pf-slbl">Categories</span></div>
          </div>
        </div>
      </header>

      {/* ══ PRODUCTS ══ */}
      <section className="pf-section">

        {/* Filter row */}
        {types.length > 1 && (
          <div className="pf-filters">
            {types.map(t => {
              const tc = getType(t);
              const TIcon = tc.icon;
              return (
                <button key={t} className={`pf-filter ${filter===t?'active':''}`} onClick={() => setFilter(t)}>
                  {t === 'all' ? <><Package size={13}/> All ({projects.length})</> : <><TIcon size={13}/> {tc.label}</>}
                </button>
              );
            })}
          </div>
        )}

        {/* Grid */}
        {visible.length > 0 ? (
          <div className="pf-grid">
            {visible.map((p, i) => <ProductCard key={p.id} p={p} index={i} creator={creator} />)}
          </div>
        ) : (
          <div className="pf-empty">
            <div style={{ fontSize: '3rem' }}>📦</div>
            <h3>No products yet</h3>
            <p>Check back soon!</p>
          </div>
        )}
      </section>

      {/* ══ FOOTER ══ */}
      <footer className="pf-footer">
        <Link href="/" className="pf-footer-logo">
          <img src="/logo-v2.png" alt="Lipapata" />
          Powered by Lipapata
        </Link>
      </footer>

      {/* ══ STYLES ══ */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes fadeUp  { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }
        @keyframes glow    { 0%,100% { box-shadow: 0 0 0 0 rgba(34,197,94,.35),0 0 0 8px rgba(34,197,94,.08); }
                             50%     { box-shadow: 0 0 0 7px rgba(34,197,94,.15),0 0 0 16px rgba(34,197,94,.04); } }

        * { box-sizing: border-box; }

        .pf-root {
          min-height: 100vh;
          background: #f1f5f9;
          font-family: 'Inter', sans-serif;
          color: #0f172a;
        }

        /* NAV */
        .pf-nav {
          position: sticky; top: 0; z-index: 100;
          display: flex; align-items: center; justify-content: space-between;
          padding: 0.85rem 1.5rem;
          background: rgba(241,245,249,.88);
          backdrop-filter: blur(14px);
          border-bottom: 1px solid rgba(0,0,0,.06);
        }
        .pf-nav-logo {
          display: flex; align-items: center; gap: .5rem;
          text-decoration: none; font-weight: 800; font-size: 1.05rem; color: #0f172a;
        }
        .pf-nav-logo img { width: 36px; height: 36px; object-fit: contain; mix-blend-mode: darken; }
        .pf-share-btn {
          padding: .45rem 1.1rem; border-radius: 100px;
          border: 1.5px solid #22c55e; background: transparent;
          color: #22c55e; font-weight: 700; font-size: .82rem; cursor: pointer;
          transition: all .2s; font-family: inherit;
        }
        .pf-share-btn:hover { background: #22c55e; color: #fff; box-shadow: 0 4px 14px rgba(34,197,94,.3); }

        /* HERO */
        .pf-hero {
          position: relative; overflow: hidden;
          padding: 4.5rem 1.5rem 3.5rem;
          text-align: center;
          background: linear-gradient(160deg,#f0fdf4 0%,#dcfce7 45%,#f1f5f9 100%);
        }
        .pf-hero-blob {
          position: absolute; border-radius: 50%;
          background: radial-gradient(circle,rgba(34,197,94,.18) 0%,transparent 70%);
          pointer-events: none;
        }
        .pf-blob1 { width: 600px; height: 600px; top: -200px; right: -150px; }
        .pf-blob2 { width: 400px; height: 400px; bottom: -150px; left: -100px; background: radial-gradient(circle,rgba(134,239,172,.15) 0%,transparent 70%); }
        .pf-hero-inner { position: relative; z-index: 1; max-width: 640px; margin: 0 auto; animation: fadeUp .5s ease both; }

        /* Avatar */
        .pf-av-wrap {
          width: 120px; height: 120px; border-radius: 50%; margin: 0 auto 1.4rem;
          padding: 3px;
          background: linear-gradient(135deg,#22c55e,#16a34a,#86efac);
          animation: glow 3s ease-in-out infinite;
        }
        .pf-av {
          width: 100%; height: 100%; border-radius: 50%; overflow: hidden;
          border: 3px solid #fff; background: #f0fdf4;
        }
        .pf-av img { width: 100%; height: 100%; object-fit: cover; }
        .pf-av-init {
          width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
          font-size: 2.8rem; font-weight: 900; color: #22c55e;
        }

        .pf-name { font-size: 2.2rem; font-weight: 900; letter-spacing: -.04em; margin: 0 0 .6rem; color: #0f172a; }
        .pf-bio  { font-size: .97rem; color: #475569; line-height: 1.65; max-width: 500px; margin: 0 auto 1.6rem; }

        /* Socials */
        .pf-socials { display: flex; gap: .5rem; justify-content: center; flex-wrap: wrap; margin-bottom: 2rem; }
        .pf-pill {
          display: inline-flex; align-items: center; gap: .35rem;
          padding: .42rem 1rem; border-radius: 100px;
          font-size: .8rem; font-weight: 600; text-decoration: none; color: #334155;
          background: #fff; border: 1px solid rgba(0,0,0,.08);
          transition: all .2s; box-shadow: 0 1px 4px rgba(0,0,0,.05);
        }
        .pf-pill:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,.1); }
        .pf-tt:hover { background: #000; color: #fff; border-color: #000; }
        .pf-ig:hover { background: linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888); color: #fff; border-color: transparent; }
        .pf-wa:hover { background: #25D366; color: #fff; border-color: #25D366; }

        /* Stats */
        .pf-stats {
          display: inline-flex; align-items: center;
          background: #fff; border: 1px solid rgba(0,0,0,.07); border-radius: 18px;
          padding: .9rem 1.8rem; box-shadow: 0 4px 20px rgba(0,0,0,.05);
        }
        .pf-stat { text-align: center; padding: 0 1.1rem; }
        .pf-sval { display: block; font-size: 1.55rem; font-weight: 900; color: #22c55e; letter-spacing: -.03em; line-height: 1; }
        .pf-slbl { display: block; font-size: .68rem; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; margin-top: .25rem; }
        .pf-sdiv { width: 1px; height: 38px; background: rgba(0,0,0,.07); flex-shrink: 0; }

        /* SECTION */
        .pf-section { max-width: 1160px; margin: 0 auto; padding: 2.5rem 1.25rem 5rem; }

        /* Filters */
        .pf-filters { display: flex; gap: .45rem; flex-wrap: wrap; margin-bottom: 1.75rem; }
        .pf-filter {
          display: inline-flex; align-items: center; gap: .35rem;
          padding: .4rem .95rem; border-radius: 100px;
          font-size: .8rem; font-weight: 600; font-family: inherit;
          border: 1.5px solid rgba(0,0,0,.08); background: #fff;
          color: #475569; cursor: pointer; transition: all .2s;
        }
        .pf-filter:hover { border-color: #22c55e; color: #22c55e; }
        .pf-filter.active { background: #22c55e; color: #fff; border-color: #22c55e; box-shadow: 0 4px 12px rgba(34,197,94,.3); }

        /* GRID — 3 cols desktop, 2 cols tablet/mobile */
        .pf-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1.5rem;
        }

        /* CARD */
        .pcard-wrap {
          display: flex; flex-direction: column; gap: 0.5rem;
          animation: fadeUp .45s ease both;
        }
        .pcard {
          display: flex; flex-direction: column;
          text-decoration: none; color: inherit;
          background: #fff;
          border-radius: 18px;
          overflow: hidden;
          border: 1px solid rgba(0,0,0,.07);
          box-shadow: 0 2px 10px rgba(0,0,0,.05);
          transition: transform .28s cubic-bezier(.4,0,.2,1), box-shadow .28s;
          flex: 1;
        }
        .pcard:hover {
          transform: translateY(-7px);
          box-shadow: 0 22px 50px rgba(0,0,0,.12);
          border-color: rgba(34,197,94,.35);
        }
        .pcard-wa-btn {
          display: flex; align-items: center; justify-content: center; gap: 0.4rem;
          background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0;
          padding: 0.5rem; border-radius: 12px; font-size: 0.8rem; font-weight: 600;
          text-decoration: none; transition: all 0.2s;
        }
        .pcard-wa-btn:hover {
          background: #25D366; color: white; border-color: #25D366;
        }

        /* Thumbnail — tall enough to show content */
        .pcard-thumb {
          position: relative;
          width: 100%;
          padding-top: 72%;        /* 4:2.88 ratio — tall & roomy */
          background: #f1f5f9;
          overflow: hidden;
        }
        .pcard-thumb img {
          position: absolute; inset: 0;
          width: 100%; height: 100%;
          object-fit: cover;
          transition: transform .45s ease;
        }
        .pcard:hover .pcard-thumb img { transform: scale(1.07); }
        .pcard-thumb-blank {
          position: absolute; inset: 0;
          display: flex; align-items: center; justify-content: center;
          border-radius: 0;
        }

        /* Hover overlay */
        .pcard-hover {
          position: absolute; inset: 0;
          background: rgba(0,0,0,.48);
          display: flex; align-items: center; justify-content: center;
          opacity: 0; transition: opacity .25s;
          backdrop-filter: blur(2px);
        }
        .pcard:hover .pcard-hover { opacity: 1; }
        .pcard-cta {
          background: #fff; color: #0f172a;
          padding: .55rem 1.35rem; border-radius: 100px;
          font-size: .82rem; font-weight: 700;
          transform: translateY(6px); transition: transform .25s;
        }
        .pcard:hover .pcard-cta { transform: translateY(0); }

        /* Type chip */
        .pcard-chip {
          position: absolute; top: .7rem; left: .7rem;
          display: inline-flex; align-items: center; gap: .28rem;
          padding: .25rem .65rem; border-radius: 100px;
          font-size: .67rem; font-weight: 700; text-transform: uppercase; letter-spacing: .04em;
          backdrop-filter: blur(6px);
        }

        /* Sales badge */
        .pcard-sales-badge {
          position: absolute; top: .7rem; right: .7rem;
          display: inline-flex; align-items: center; gap: .25rem;
          background: rgba(0,0,0,.55); color: #fff;
          padding: .22rem .6rem; border-radius: 100px;
          font-size: .67rem; font-weight: 700;
        }

        /* Card body */
        .pcard-body {
          padding: 1rem 1.1rem 1.15rem;
          display: flex; flex-direction: column; gap: .6rem; flex: 1;
        }
        .pcard-title {
          font-size: .9rem; font-weight: 700; color: #0f172a;
          line-height: 1.4; margin: 0;
          display: -webkit-box; -webkit-line-clamp: 2;
          -webkit-box-orient: vertical; overflow: hidden;
        }
        .pcard-footer {
          display: flex; align-items: center; justify-content: space-between;
          padding-top: .55rem; border-top: 1px solid #f1f5f9; margin-top: auto;
        }
        .pcard-price { font-size: .97rem; font-weight: 800; color: #16a34a; }
        .pcard-arrow {
          font-size: 1rem; color: #cbd5e1;
          transition: color .2s, transform .2s;
        }
        .pcard:hover .pcard-arrow { color: #22c55e; transform: translateX(3px); }

        /* Empty */
        .pf-empty { text-align: center; padding: 5rem 2rem; color: #64748b; }
        .pf-empty h3 { color: #334155; margin: .5rem 0 .3rem; font-size: 1.2rem; }
        .pf-empty p  { font-size: .9rem; }

        /* Footer */
        .pf-footer {
          border-top: 1px solid rgba(0,0,0,.06);
          padding: 1.4rem 1.5rem;
          display: flex; justify-content: center;
          background: #fff;
        }
        .pf-footer-logo {
          display: flex; align-items: center; gap: .5rem;
          text-decoration: none; color: #94a3b8; font-size: .82rem; font-weight: 600;
        }
        .pf-footer-logo img { width: 24px; height: 24px; object-fit: contain; mix-blend-mode: darken; opacity: .5; }

        /* ─── Responsive ─── */
        @media (max-width: 900px) {
          .pf-grid { grid-template-columns: repeat(2, 1fr); gap: 1rem; }
        }

        @media (max-width: 600px) {
          .pf-hero  { padding: 3rem 1rem 2.5rem; }
          .pf-name  { font-size: 1.8rem; }
          .pf-bio   { font-size: .9rem; }
          .pf-stats { padding: .75rem 1.1rem; }
          .pf-stat  { padding: 0 .75rem; }
          .pf-sval  { font-size: 1.25rem; }
          .pf-section { padding: 1.75rem 1rem 4rem; }
          .pf-grid  { grid-template-columns: repeat(2, 1fr); gap: .85rem; }
          .pcard-body { padding: .8rem .85rem .9rem; }
          .pcard-title { font-size: .82rem; }
          .pcard-price { font-size: .88rem; }
          .pf-av-wrap { width: 100px; height: 100px; }
          .pf-av-init { font-size: 2.3rem; }
        }

        @media (max-width: 380px) {
          .pf-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
