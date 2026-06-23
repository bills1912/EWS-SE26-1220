/**
 * src/hooks/useEWSData.js
 * =======================
 * BASE_URL diambil dari window.__API_URL__ yang di-inject
 * oleh index.html saat halaman dimuat — tidak tergantung build-time env.
 */

import { useState, useEffect } from 'react';

const TOKEN_KEY = 'ews_token';

function getBaseURL() {
  // Prioritas 1: inject runtime dari index.html (window.__API_URL__)
  if (typeof window !== 'undefined' && window.__API_URL__) {
    return window.__API_URL__.replace(/\/$/, '');
  }
  // Prioritas 2: Vite build-time env
  const env = import.meta.env.VITE_API_URL;
  if (env && env !== 'undefined' && env !== '') {
    return env.replace(/\/$/, '');
  }
  // Prioritas 3: dev lokal
  return 'http://localhost:3001';
}

async function apiFetch(path) {
  const BASE_URL = getBaseURL(); // dipanggil setiap request, bukan sekali saat load
  const token = localStorage.getItem(TOKEN_KEY);

  if (!token) {
    throw new Error('Token tidak ditemukan. Silakan login.');
  }

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
  } catch {
    throw new Error('Tidak dapat terhubung ke server API. Periksa koneksi.');
  }

  if (res.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('ews_user');
    window.dispatchEvent(new Event('ews:unauthorized'));
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Sesi berakhir. Silakan login kembali.');
  }

  if (!res.ok) {
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      throw new Error(`Server error (${res.status}). BASE_URL: ${BASE_URL}`);
    }
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export function useStatistik() {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  useEffect(() => {
    let cancelled = false;
    apiFetch('/api/statistik')
      .then(data => { if (!cancelled) setState({ data, loading: false, error: null }); })
      .catch(err  => { if (!cancelled) setState({ data: null, loading: false, error: err.message }); });
    return () => { cancelled = true; };
  }, []);
  return state;
}

export function useResponden(params = {}) {
  const [state, setState] = useState({ data: [], total: 0, totalPages: 1, loading: true, error: null });
  const paramsKey = JSON.stringify(params);
  useEffect(() => {
    let cancelled = false;
    setState(s => ({ ...s, loading: true }));
    const qs = new URLSearchParams();
    if (params.page)      qs.set('page',      params.page);
    if (params.limit)     qs.set('limit',     params.limit);
    if (params.kecamatan) qs.set('kecamatan', params.kecamatan);
    if (params.desa)      qs.set('desa',      params.desa);
    if (params.petugas)   qs.set('petugas',   params.petugas);
    if (params.status)    qs.set('status',    params.status);
    if (params.anomaly)   qs.set('anomaly',   params.anomaly);
    if (params.q)         qs.set('q',         params.q);
    if (params.kbli)      qs.set('kbli',      params.kbli);
    apiFetch(`/api/responden?${qs}`)
      .then(res => {
        if (!cancelled) setState({ data: res.data, total: res.total, totalPages: res.totalPages, loading: false, error: null });
      })
      .catch(err => { if (!cancelled) setState(s => ({ ...s, loading: false, error: err.message })); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey]);
  return state;
}

export function useRespondenDetail(id) {
  const [state, setState] = useState({ data: null, loading: false, error: null });
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setState({ data: null, loading: true, error: null });
    apiFetch(`/api/responden/${id}`)
      .then(data => { if (!cancelled) setState({ data, loading: false, error: null }); })
      .catch(err  => { if (!cancelled) setState({ data: null, loading: false, error: err.message }); });
    return () => { cancelled = true; };
  }, [id]);
  return state;
}

export function usePetugas(params = {}) {
  const [state, setState] = useState({ data: [], loading: true, error: null });
  const paramsKey = JSON.stringify(params);
  useEffect(() => {
    let cancelled = false;
    const qs = new URLSearchParams();
    if (params.kec) qs.set('kec', params.kec);
    apiFetch(`/api/petugas?${qs}`)
      .then(data => { if (!cancelled) setState({ data, loading: false, error: null }); })
      .catch(err  => { if (!cancelled) setState({ data: [], loading: false, error: err.message }); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey]);
  return state;
}

export function useKecamatan() {
  const [state, setState] = useState({ data: [], loading: true, error: null });
  useEffect(() => {
    apiFetch('/api/kecamatan')
      .then(data => setState({ data, loading: false, error: null }))
      .catch(err  => setState({ data: [], loading: false, error: err.message }));
  }, []);
  return state;
}