/**
 * src/hooks/useEWSData.js
 * =======================
 * Custom hooks untuk mengambil data dari API EWS SE2026.
 *
 * Strategi URL API (runtime, bukan build-time):
 * 1. Jika ada window.__API_URL__ (disuntik server) → pakai itu
 * 2. Jika ada import.meta.env.VITE_API_URL → pakai itu  
 * 3. Jika hostname bukan localhost → tebak URL backend dari hostname frontend
 * 4. Fallback ke localhost:3001
 */

import { useState, useEffect } from 'react';

function resolveBaseURL() {
  // Prioritas 1: runtime injection via window.__API_URL__
  if (typeof window !== 'undefined' && window.__API_URL__) {
    return window.__API_URL__;
  }

  // Prioritas 2: build-time env (tersedia jika Railway inject saat build)
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && envUrl !== 'undefined') {
    return envUrl;
  }

  // Prioritas 3: auto-detect — jika bukan localhost, coba tebak URL backend
  // Railway biasanya: frontend = ews-frontend.up.railway.app
  //                   backend  = ews-api.up.railway.app
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    // Kembalikan string kosong → fetch pakai relative URL /api/...
    // Ini hanya works jika frontend & backend di domain yang sama atau ada reverse proxy
    return '';
  }

  // Prioritas 4: fallback dev lokal
  return 'http://localhost:3001';
}

const BASE_URL = resolveBaseURL();

async function apiFetch(path) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url);
  if (!res.ok) {
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
      .catch(err => { if (!cancelled) setState({ data: null, loading: false, error: err.message }); });
    return () => { cancelled = true; };
  }, []);
  return state;
}

export function useResponden(params = {}) {
  const [state, setState] = useState({
    data: [], total: 0, totalPages: 1, loading: true, error: null
  });
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
        if (!cancelled) setState({
          data: res.data, total: res.total,
          totalPages: res.totalPages, loading: false, error: null
        });
      })
      .catch(err => {
        if (!cancelled) setState(s => ({ ...s, loading: false, error: err.message }));
      });
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
      .catch(err => { if (!cancelled) setState({ data: null, loading: false, error: err.message }); });
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
      .catch(err => { if (!cancelled) setState({ data: [], loading: false, error: err.message }); });
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
      .catch(err => setState({ data: [], loading: false, error: err.message }));
  }, []);
  return state;
}