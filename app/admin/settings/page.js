'use client';

import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { Settings, Percent, Save, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';

export default function AdminSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    globalCommission: 3,
    minWithdrawal: 500,
    maintenanceMode: false
  });
  const [message, setMessage] = useState(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const docSnap = await getDoc(doc(db, 'settings', 'global'));
      if (docSnap.exists()) {
        const data = docSnap.data();
        // Firestore stores as decimal (e.g. 0.03). Convert to % for display.
        setSettings({
          ...data,
          globalCommission: data.globalCommission !== undefined
            ? (data.globalCommission < 1 ? data.globalCommission * 100 : data.globalCommission)
            : 3,
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      // Store commission as decimal (e.g. 3% → 0.03) so commission.js reads it correctly
      await setDoc(doc(db, 'settings', 'global'), {
        ...settings,
        globalCommission: parseFloat(settings.globalCommission) / 100,
        updatedAt: serverTimestamp()
      });
      setMessage({ type: 'success', text: 'Settings saved! Commission is now ' + settings.globalCommission + '%.' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to update settings.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div>Loading settings...</div>;

  return (
    <div className="admin-page">
      <header className="page-header">
        <div>
          <h1>Platform Settings</h1>
          <p>Control global parameters and financial rules</p>
        </div>
      </header>

      <div className="settings-grid">
        <form onSubmit={saveSettings} className="settings-form glass-card">
          <div className="section-title">
            <Percent size={20} />
            <h3>Financial Configuration</h3>
          </div>

          <div className="input-group">
            <label>Global Commission Rate (%)</label>
            <div className="input-with-icon">
              <input 
                type="number" 
                value={settings.globalCommission}
                onChange={(e) => setSettings({...settings, globalCommission: parseFloat(e.target.value)})}
              />
              <span>%</span>
            </div>
            <small>This rate is applied to all transactions across the platform.</small>
          </div>

          <div className="input-group">
            <label>Minimum Withdrawal Amount (KSh)</label>
            <div className="input-with-icon">
              <input 
                type="number" 
                value={settings.minWithdrawal}
                onChange={(e) => setSettings({...settings, minWithdrawal: parseFloat(e.target.value)})}
              />
              <span>KSh</span>
            </div>
          </div>

          <div className="section-title" style={{ marginTop: '2rem' }}>
            <ShieldCheck size={20} />
            <h3>Platform Security</h3>
          </div>

          <div className="toggle-group">
            <div className="toggle-info">
              <label>Maintenance Mode</label>
              <p>Disable all transactions and uploads while active.</p>
            </div>
            <input 
              type="checkbox" 
              checked={settings.maintenanceMode}
              onChange={(e) => setSettings({...settings, maintenanceMode: e.target.checked})}
            />
          </div>

          {message && (
            <div className={`message-box ${message.type}`}>
              {message.type === 'success' ? <ShieldCheck size={18} /> : <AlertCircle size={18} />}
              {message.text}
            </div>
          )}

          <button className="btn-primary" disabled={saving} style={{ marginTop: '2rem', width: '100%' }}>
            {saving ? <Loader2 className="spin" size={20} /> : <><Save size={20} /> Save Changes</>}
          </button>
        </form>

        <div className="settings-help">
          <div className="help-card glass-card">
            <h3>Commission Impact</h3>
            <p>Changing the global commission will immediately affect the breakdown on all preview pages. Already initiated STK pushes will use the rate at the time of initiation.</p>
          </div>
        </div>
      </div>

      <style jsx>{`
        .admin-page { display: flex; flex-direction: column; gap: 2rem; }
        .page-header h1 { font-size: 2rem; }
        
        .settings-grid { display: grid; grid-template-columns: 1fr 350px; gap: 2rem; }
        .settings-form { padding: 2.5rem; display: flex; flex-direction: column; gap: 1.5rem; }
        
        .section-title { display: flex; align-items: center; gap: 0.8rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 1rem; margin-bottom: 0.5rem; }
        .section-title h3 { font-size: 1.2rem; }
        
        .input-group { display: flex; flex-direction: column; gap: 0.5rem; }
        .input-group label { font-size: 0.9rem; opacity: 0.8; }
        .input-group small { font-size: 0.8rem; opacity: 0.4; line-height: 1.4; }
        
        .input-with-icon { position: relative; }
        .input-with-icon input { width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); padding: 0.8rem 3rem 0.8rem 1rem; border-radius: 12px; color: black; font-size: 1.1rem; font-weight: 700; }
        .input-with-icon span { position: absolute; right: 1rem; top: 50%; transform: translateY(-50%); opacity: 0.4; font-weight: 600; }
        
        .toggle-group { display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); padding: 1.2rem; border-radius: 12px; }
        .toggle-info label { display: block; font-weight: 600; margin-bottom: 0.2rem; }
        .toggle-info p { font-size: 0.8rem; opacity: 0.5; }
        
        .message-box { display: flex; align-items: center; gap: 0.8rem; padding: 1rem; border-radius: 10px; font-size: 0.9rem; }
        .message-box.success { background: rgba(16, 185, 129, 0.1); color: #10b981; }
        .message-box.error { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
        
        .help-card { padding: 1.5rem; }
        .help-card h3 { font-size: 1.1rem; margin-bottom: 0.8rem; color: var(--primary); }
        .help-card p { font-size: 0.9rem; opacity: 0.6; line-height: 1.6; }
        
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }

        @media (max-width: 768px) {
          .settings-grid { grid-template-columns: 1fr; }
          .settings-form { padding: 1.5rem; }
          .page-header { text-align: center; }
          .toggle-group { flex-direction: column; align-items: flex-start; gap: 1rem; }
        }
      `}</style>
    </div>
  );
}
