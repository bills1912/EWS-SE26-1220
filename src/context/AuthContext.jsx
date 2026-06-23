/**
 * src/context/AuthContext.jsx
 * ============================
 * Context global untuk state autentikasi.
 * Menyimpan token di localStorage, auto-expired check,
 * dan inject Authorization header ke semua fetch.
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);
const TOKEN_KEY = 'ews_token';
const USER_KEY  = 'ews_user';

function getBaseURL() {
  if (typeof window !== 'undefined' && window.__API_URL__) {
    return window.__API_URL__.replace(/\/$/, '');
  }
  const env = import.meta.env.VITE_API_URL;
  if (env && env !== 'undefined' && env !== '') return env.replace(/\/$/, '');
  return 'http://localhost:3001';
}

export function AuthProvider({ children }) {
  const [token, setToken]     = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user,  setUser]      = useState(() => {
    try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; }
  });
  const [loading, setLoading] = useState(true); // cek token awal

  // Verifikasi token saat app pertama load
  useEffect(() => {
    if (!token) { setLoading(false); return; }
    fetch(`${getBaseURL()}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        if (data.user) {
          setUser(data.user);
        } else {
          // Token expired/invalid — logout
          logout();
        }
      })
      .catch(() => logout())
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (username, password) => {
    let res;
    try {
      res = await fetch(`${getBaseURL()}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
    } catch {
      throw new Error('Tidak dapat terhubung ke server. Periksa koneksi internet.');
    }

    // Cek apakah response adalah JSON (bukan HTML error page dari server)
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      if (res.status === 404) throw new Error('Endpoint login tidak ditemukan. Backend belum diupdate — hubungi administrator.');
      if (res.status === 503) throw new Error('Server sedang tidak tersedia. Coba beberapa saat lagi.');
      throw new Error(`Server error (${res.status}). Hubungi administrator.`);
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login gagal');

    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY,  JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, login, logout, loading, isAuthenticated: !!token && !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth harus dipakai di dalam AuthProvider');
  return ctx;
};