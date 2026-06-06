'use client';

import { useState } from 'react';
import { Mail, Lock, LogIn, User, Phone } from 'lucide-react';
import { auth, db } from '../../lib/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
        if (userDoc.exists() && userDoc.data().role === 'admin') {
          router.push('/admin');
          return;
        }
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Save extra details to Firestore
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          name: name,
          phone: phone,
          whatsapp: whatsapp,
          email: email,
          role: 'creator', // Default role
          createdAt: new Date().toISOString()
        });
      }
      router.push('/dashboard');
    } catch (err) {
      setError(err.message.replace('Firebase:', ''));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Check if user exists in Firestore, if not create
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) {
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          name: user.displayName || '',
          email: user.email,
          role: 'creator',
          createdAt: new Date().toISOString()
        });
      } else if (userDoc.data().role === 'admin') {
        router.push('/admin');
        return;
      }
      
      router.push('/dashboard');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="auth-container">
      <nav className="auth-nav">
        <Link href="/" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="logo-container" style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <img src="/logo-v2.png" alt="Lipapata Logo" style={{ width: '100px', height: '100px', objectFit: 'contain', mixBlendMode: 'darken' }} />
            <div className="logo" style={{ fontSize: '1.5rem', fontWeight: '800', color: 'black' }}>Lipapata<span>.</span></div>
          </div>
        </Link>
      </nav>

      <main className="auth-content">
        <div className="auth-card glass-card">
          <div className="auth-header">
            <h1>{isLogin ? 'Welcome Back' : 'Join Lipapata'}</h1>
            <p>{isLogin ? 'Manage your digital work and earnings' : 'Start protecting and selling your work today'}</p>
          </div>

          {error && <div className="error-message">{error}</div>}

          <form onSubmit={handleAuth}>
            {!isLogin && (
              <>
                <div className="input-group">
                  <label><User size={16} /> Full Name</label>
                  <input 
                    type="text" 
                    placeholder="John Doe" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required={!isLogin}
                  />
                </div>

                <div className="input-group">
                  <label><Phone size={16} /> Phone Number (M-Pesa)</label>
                  <input 
                    type="tel" 
                    placeholder="254700000000" 
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required={!isLogin}
                  />
                </div>

                <div className="input-group">
                  <label><Phone size={16} /> WhatsApp Number (Optional)</label>
                  <input 
                    type="tel" 
                    placeholder="254700000000" 
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                  />
                  <small style={{ opacity: 0.6, fontSize: '0.75rem', marginTop: '0.2rem', display: 'block' }}>
                    Buyers will be able to contact you via this number on your portfolio.
                  </small>
                </div>
              </>
            )}

            <div className="input-group">
              <label><Mail size={16} /> Email Address</label>
              <input 
                type="email" 
                placeholder="you@example.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="input-group">
              <label><Lock size={16} /> Password</label>
              <input 
                type="password" 
                placeholder="••••••••" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button className="btn-primary auth-submit" disabled={loading} style={{ width: '100%', padding: '1rem', marginTop: '1rem' }}>
              {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}
            </button>
          </form>

          <div className="divider" style={{ margin: '2rem 0', textAlign: 'center', opacity: 0.5 }}>
            <span>or continue with</span>
          </div>

          <div className="social-auth" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
            <button className="btn-social" onClick={handleGoogleSignIn} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '0.8rem', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', cursor: 'pointer' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M23.766 12.2764C23.766 11.4607 23.6999 10.6406 23.5588 9.83807H12.24V14.4591H18.7217C18.4528 15.9494 17.5885 17.2678 16.323 18.1056V21.1039H20.1905C22.4608 19.0139 23.766 15.9274 23.766 12.2764Z" fill="#4285F4"/>
                <path d="M12.24 24.0008C15.4765 24.0008 18.2059 22.9382 20.1945 21.1039L16.327 18.1055C15.2517 18.8375 13.8627 19.252 12.2445 19.252C9.11388 19.252 6.45946 17.1399 5.50705 14.3003H1.5166V17.3912C3.55371 21.4434 7.7029 24.0008 12.24 24.0008Z" fill="#34A853"/>
                <path d="M5.50254 14.3003C5.25746 13.5744 5.12687 12.8029 5.12687 12.0004C5.12687 11.1979 5.25746 10.4264 5.50254 9.70049V6.60956H1.5166C0.685322 8.2759 0.213379 10.0886 0.213379 12.0004C0.213379 13.9122 0.685322 15.7249 1.5166 17.3912L5.50254 14.3003Z" fill="#FBBC05"/>
                <path d="M12.24 4.74966C14.0074 4.74966 15.5951 5.35624 16.8439 6.54809L20.2693 3.12262C18.2014 1.1932 15.472 0 12.24 0C7.7029 0 3.55371 2.55744 1.5166 6.60956L5.50254 9.70049C6.45946 6.86089 9.11388 4.74966 12.24 4.74966Z" fill="#EA4335"/>
              </svg>
              Sign in with Google
            </button>
          </div>

          <p className="auth-toggle" style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.9rem' }}>
            {isLogin ? "Don't have an account?" : "Already have an account?"}
            <button onClick={() => setIsLogin(!isLogin)} style={{ background: 'none', border: 'none', color: '#00d2ff', fontWeight: 'bold', marginLeft: '0.5rem', cursor: 'pointer' }}>
              {isLogin ? 'Sign Up' : 'Log In'}
            </button>
          </p>
        </div>
      </main>

      <style jsx>{`
        .auth-container {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          padding: 2rem;
          background: var(--background);
        }

        .auth-nav {
          width: 100%;
          max-width: 1200px;
          margin: 0 auto 2rem;
        }

        .logo { font-size: 1.5rem; font-weight: 800; }
        .logo span { color: var(--primary); }

        .auth-content {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .auth-card {
          width: 100%;
          max-width: 450px;
          padding: 3rem;
        }

        .auth-header {
          text-align: center;
          margin-bottom: 2rem;
        }

        .auth-header h1 { font-size: 1.8rem; margin-bottom: 0.5rem; }
        .auth-header p { opacity: 0.6; font-size: 0.9rem; }

        .input-group {
          margin-bottom: 1.2rem;
        }

        .input-group label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.5rem;
          font-size: 0.85rem;
          opacity: 0.7;
        }

        .input-group input {
          width: 100%;
          padding: 0.8rem;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--glass-border);
          color: black;
          outline: none;
        }

        .error-message {
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
          padding: 0.8rem;
          border-radius: 8px;
          margin-bottom: 1.5rem;
          font-size: 0.85rem;
          text-align: center;
          border: 1px solid rgba(239, 68, 68, 0.2);
        }
        @media (max-width: 480px) {
          .auth-container { padding: 1rem; }
          .auth-card {
            width: 100%;
            padding: 2rem 1.2rem;
            border-radius: 16px;
          }
          .auth-header h1 { font-size: 1.6rem; }
          .logo-container img { width: 60px !important; height: 60px !important; }
          .logo { font-size: 1.2rem !important; }
        }
      `}</style>
    </div>
  );
}
