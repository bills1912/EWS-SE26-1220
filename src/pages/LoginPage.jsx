/**
 * src/pages/LoginPage.jsx
 * ========================
 * Halaman login dengan desain konsisten dark-github EWS SE2026.
 */

import { useState, useEffect } from 'react';
import { Activity, Eye, EyeOff, LogIn, Shield, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [shake,    setShake]    = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Username dan password wajib diisi.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await login(username.trim(), password);
      // AuthContext akan update state → App.jsx redirect ke dashboard
    } catch (err) {
      setError(err.message);
      setShake(true);
      setTimeout(() => setShake(false), 600);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg0)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background glow efek */}
      <div style={{
        position: 'absolute',
        top: '20%', left: '50%',
        transform: 'translateX(-50%)',
        width: 600, height: 600,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }}/>

      <div
        className={shake ? 'shake' : ''}
        style={{
          width: '100%',
          maxWidth: 400,
          animation: 'fadeUp .4s ease both',
        }}
      >
        {/* Logo + nama */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: 'linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 0 32px rgba(99,102,241,0.4)',
          }}>
            <Activity size={26} color="#fff" strokeWidth={2.2}/>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text1)', letterSpacing: '-0.02em', marginBottom: 4 }}>
            EWS SE2026
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Early Warning System · BPS Padang Lawas Utara
          </div>
        </div>

        {/* Card login */}
        <div style={{
          background: 'var(--bg2)',
          border: '1px solid var(--border2)',
          borderRadius: 16,
          padding: '28px 28px 24px',
          boxShadow: '0 8px 48px rgba(0,0,0,0.4)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <Shield size={14} color="var(--indigo3)" strokeWidth={2}/>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Akses terbatas
            </span>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            {/* Username */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={e => { setUsername(e.target.value); setError(''); }}
                autoComplete="username"
                autoFocus
                placeholder="Masukkan username"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  fontSize: 13,
                  background: 'var(--bg3)',
                  border: `1px solid ${error ? 'rgba(244,63,94,0.5)' : 'var(--border2)'}`,
                  borderRadius: 9,
                  color: 'var(--text1)',
                  outline: 'none',
                  fontFamily: 'var(--font)',
                  transition: 'border-color .15s',
                }}
                onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.6)'}
                onBlur={e => e.target.style.borderColor = error ? 'rgba(244,63,94,0.5)' : 'var(--border2)'}
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  autoComplete="current-password"
                  placeholder="Masukkan password"
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '10px 40px 10px 14px',
                    fontSize: 13,
                    background: 'var(--bg3)',
                    border: `1px solid ${error ? 'rgba(244,63,94,0.5)' : 'var(--border2)'}`,
                    borderRadius: 9,
                    color: 'var(--text1)',
                    outline: 'none',
                    fontFamily: 'var(--font)',
                    transition: 'border-color .15s',
                  }}
                  onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.6)'}
                  onBlur={e => e.target.style.borderColor = error ? 'rgba(244,63,94,0.5)' : 'var(--border2)'}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  tabIndex={-1}
                  style={{
                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text3)', padding: 4, display: 'flex', alignItems: 'center',
                  }}
                >
                  {showPass ? <EyeOff size={14} strokeWidth={2}/> : <Eye size={14} strokeWidth={2}/>}
                </button>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 8,
                background: 'rgba(244,63,94,0.08)',
                border: '1px solid rgba(244,63,94,0.25)',
                borderRadius: 8, padding: '10px 12px', marginBottom: 16,
                animation: 'fadeUp .2s ease both',
              }}>
                <AlertCircle size={13} color="#f87171" strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }}/>
                <span style={{ fontSize: 12, color: '#f87171', lineHeight: 1.5 }}>{error}</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '11px',
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 9,
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                background: loading
                  ? 'var(--bg4)'
                  : 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                color: loading ? 'var(--text3)' : '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'all .2s',
                boxShadow: loading ? 'none' : '0 4px 20px rgba(99,102,241,0.35)',
                fontFamily: 'var(--font)',
              }}
            >
              {loading ? (
                <>
                  <div style={{
                    width: 14, height: 14, borderRadius: '50%',
                    border: '2px solid var(--text4)',
                    borderTopColor: 'var(--text2)',
                    animation: 'spin .8s linear infinite',
                  }}/>
                  Memverifikasi…
                </>
              ) : (
                <>
                  <LogIn size={14} strokeWidth={2}/>
                  Masuk
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 10, color: 'var(--text4)', lineHeight: 1.7 }}>
          Data SE2026 bersifat rahasia.<br/>
          Akses hanya untuk petugas BPS yang berwenang.
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-8px); }
          40%, 80% { transform: translateX(8px); }
        }
        .shake { animation: shake .5s ease; }
      `}</style>
    </div>
  );
}
