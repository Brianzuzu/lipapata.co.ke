'use client';

import { useState, useEffect } from 'react';
import { db, auth } from '../../../../lib/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { Star, CheckCircle2, ArrowRight, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function RateCreatorPage({ params }) {
  const { taskId } = params;
  const [task, setTask] = useState(null);
  const [submission, setSubmission] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [selectedStar, setSelectedStar] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [leveledUp, setLeveledUp] = useState(false);
  const [newLevel, setNewLevel] = useState(null);

  const LEVEL_LABELS = ['', '🌱 New Talent', '⭐ Rising Star', '🚀 Pro', '💎 Elite'];

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!taskId) return;
    const load = async () => {
      try {
        // Load task
        const taskDoc = await getDoc(doc(db, 'tasks', taskId));
        if (taskDoc.exists()) {
          setTask({ id: taskDoc.id, ...taskDoc.data() });
        }

        // Load the paid submission for this task (the one that was unlocked)
        const q = query(collection(db, 'task_submissions'), where('taskId', '==', taskId));
        const snaps = await getDocs(q);

        // Find the submission that has a paid project linked
        for (const s of snaps.docs) {
          const data = s.data();
          if (data.projectId) {
            const qTrans = query(
              collection(db, 'transactions'),
              where('projectId', '==', data.projectId),
              where('status', '==', 'completed')
            );
            const tSnap = await getDocs(qTrans);
            if (!tSnap.empty) {
              setSubmission({ id: s.id, ...data });
              break;
            }
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [taskId]);

  const handleRate = async () => {
    if (!selectedStar || !submission || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/tasks/rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId: submission.id,
          taskId,
          creatorUid: submission.creatorUid,
          rating: selectedStar,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSubmitted(true);
        setLeveledUp(data.leveledUp);
        setNewLevel(data.newLevel);
      } else {
        alert(data.error || 'Failed to submit rating.');
      }
    } catch (err) {
      alert('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const starLabels = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent!'];

  if (loading) {
    return (
      <div style={styles.center}>
        <Loader2 size={40} className="spin" style={{ color: 'var(--primary)', animation: 'spin 1s linear infinite' }} />
        <p style={{ marginTop: '1rem', color: '#64748b' }}>Loading...</p>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* Logo */}
        <Link href="/" style={{ textDecoration: 'none' }}>
          <div style={styles.logo}>Lipapata<span style={{ color: 'var(--primary)' }}>.</span></div>
        </Link>

        {submitted ? (
          // ─── Success State ───────────────────────────
          <div style={styles.successBox}>
            <CheckCircle2 size={56} color="#10b981" />
            <h2 style={styles.successTitle}>Thank you for your rating!</h2>
            {leveledUp && newLevel && (
              <div style={styles.levelUpBanner}>
                🎉 <strong>{submission?.creatorName || 'The creator'}</strong> just levelled up to <strong>{LEVEL_LABELS[newLevel]}</strong>!
              </div>
            )}
            <p style={{ color: '#64748b', marginTop: '1rem', marginBottom: '2rem' }}>
              Your feedback helps Lipapata maintain quality and rewards great creators.
            </p>
            <Link href="/dashboard">
              <button style={styles.btnPrimary}>
                Go to Dashboard <ArrowRight size={16} />
              </button>
            </Link>
          </div>
        ) : (
          // ─── Rating State ────────────────────────────
          <>
            <div style={styles.badge}>Rate Your Creator</div>
            <h1 style={styles.title}>
              How was your experience with{' '}
              <span style={{ color: 'var(--primary)' }}>
                {submission?.creatorName || 'the creator'}
              </span>
              ?
            </h1>
            {task && (
              <p style={styles.taskLabel}>
                📋 Task: <strong>{task.title}</strong>
              </p>
            )}

            {/* Star Selector */}
            <div style={styles.starRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  style={styles.starBtn}
                  onMouseEnter={() => setHoveredStar(star)}
                  onMouseLeave={() => setHoveredStar(0)}
                  onClick={() => setSelectedStar(star)}
                >
                  <Star
                    size={48}
                    fill={(hoveredStar || selectedStar) >= star ? '#f59e0b' : 'transparent'}
                    color={(hoveredStar || selectedStar) >= star ? '#f59e0b' : '#cbd5e1'}
                    strokeWidth={1.5}
                    style={{ transition: 'all 0.15s ease' }}
                  />
                </button>
              ))}
            </div>

            {(hoveredStar || selectedStar) > 0 && (
              <p style={styles.starLabel}>
                {starLabels[hoveredStar || selectedStar]}
              </p>
            )}

            {!submission && (
              <p style={{ color: '#ef4444', fontSize: '0.9rem', marginTop: '1rem' }}>
                No paid submission was found for this task. Make sure you have unlocked a deliverable first.
              </p>
            )}

            <button
              onClick={handleRate}
              disabled={!selectedStar || !submission || isSubmitting}
              style={{
                ...styles.btnPrimary,
                marginTop: '2rem',
                opacity: (!selectedStar || !submission) ? 0.5 : 1,
                cursor: (!selectedStar || !submission) ? 'not-allowed' : 'pointer',
              }}
            >
              {isSubmitting ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : null}
              {isSubmitting ? 'Submitting...' : 'Submit Rating'}
            </button>

            <Link href="/dashboard" style={{ display: 'block', textAlign: 'center', marginTop: '1.5rem' }}>
              <span style={{ color: '#94a3b8', fontSize: '0.85rem', cursor: 'pointer' }}>Skip for now</span>
            </Link>
          </>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        :root { --primary: #10b981; --primary-glow: #d1fae5; }
        * { box-sizing: border-box; }
        body { margin: 0; font-family: 'Inter', sans-serif; background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 50%, #f8fafc 100%); min-height: 100vh; }
      `}</style>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
  },
  center: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    background: 'white',
    borderRadius: '24px',
    padding: '3rem 2.5rem',
    maxWidth: '520px',
    width: '100%',
    boxShadow: '0 20px 60px rgba(0,0,0,0.08)',
    textAlign: 'center',
  },
  logo: {
    fontSize: '1.8rem',
    fontWeight: 900,
    color: '#0f172a',
    textDecoration: 'none',
    marginBottom: '2rem',
    display: 'block',
  },
  badge: {
    display: 'inline-block',
    background: '#d1fae5',
    color: '#065f46',
    padding: '0.3rem 1rem',
    borderRadius: '100px',
    fontWeight: 700,
    fontSize: '0.8rem',
    marginBottom: '1rem',
  },
  title: {
    fontSize: '1.6rem',
    fontWeight: 800,
    color: '#0f172a',
    marginBottom: '0.5rem',
    lineHeight: 1.3,
  },
  taskLabel: {
    color: '#64748b',
    fontSize: '0.9rem',
    marginBottom: '2rem',
  },
  starRow: {
    display: 'flex',
    justifyContent: 'center',
    gap: '0.5rem',
    margin: '1.5rem 0 0.5rem',
  },
  starBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '0.25rem',
    borderRadius: '8px',
    transition: 'transform 0.1s',
  },
  starLabel: {
    fontWeight: 700,
    fontSize: '1.1rem',
    color: '#f59e0b',
    height: '1.5rem',
    margin: 0,
  },
  btnPrimary: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    justifyContent: 'center',
    background: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    padding: '0.85rem 2rem',
    fontWeight: 700,
    fontSize: '1rem',
    cursor: 'pointer',
    width: '100%',
    transition: 'transform 0.15s, box-shadow 0.15s',
  },
  successBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  successTitle: {
    fontSize: '1.6rem',
    fontWeight: 900,
    color: '#0f172a',
    marginTop: '1rem',
  },
  levelUpBanner: {
    background: '#fef3c7',
    border: '1px solid #fcd34d',
    borderRadius: '12px',
    padding: '0.8rem 1.2rem',
    marginTop: '1rem',
    color: '#92400e',
    fontWeight: 600,
    fontSize: '0.95rem',
  },
};
