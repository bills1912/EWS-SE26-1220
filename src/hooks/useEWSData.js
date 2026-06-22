/**
 * src/hooks/useEWSData.js
 * =======================
 * Custom hooks untuk mengambil data dari API EWS SE2026.
 * Menggantikan semua import langsung dari src/data/dummy.js dan responden.js.
 *
 * Cara pakai di komponen:
 *   import { useStatistik, useResponden } from '../hooks/useEWSData';
 *
 *   const { data: statistik, loading, error } = useStatistik();
 *   const { data, total, loading } = useResponden({ page: 1, kecamatan: 'Portibi' });
 */

import { useState, useEffect, useCallback, useRef } from 'react';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// ── Fetcher generik ───────────────────────────────────────────────────────
async function apiFetch(path) {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Hook: useStatistik ────────────────────────────────────────────────────
/**
 * Ambil satu dokumen statistik lengkap dari MongoDB.
 * Berisi: summary, pace, anomali, heatmap, dailyTrend, kbliData,
 *         kategoriUsaha, petugas, outlierDurasi, outlierPendapatan,
 *         outlierJumlahAk, tickerPhrases
 */
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

// ── Hook: useResponden ────────────────────────────────────────────────────
/**
 * Ambil daftar responden dengan pagination & filter.
 * @param {object} params - { page, limit, kecamatan, status, anomaly, q, petugas }
 */
export function useResponden(params = {}) {
  const [state, setState] = useState({
    data: [], total: 0, totalPages: 1, loading: true, error: null
  });

  // Stringify params untuk dependency
  const paramsKey = JSON.stringify(params);

  useEffect(() => {
    let cancelled = false;
    setState(s => ({ ...s, loading: true }));

    const qs = new URLSearchParams();
    if (params.page)       qs.set('page',       params.page);
    if (params.limit)      qs.set('limit',      params.limit);
    if (params.kecamatan)  qs.set('kecamatan',  params.kecamatan);
    if (params.desa)       qs.set('desa',       params.desa);
    if (params.petugas)    qs.set('petugas',    params.petugas);
    if (params.status)     qs.set('status',     params.status);
    if (params.anomaly)    qs.set('anomaly',    params.anomaly);
    if (params.q)          qs.set('q',          params.q);
    if (params.kbli)       qs.set('kbli',       params.kbli);

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

// ── Hook: useRespondenDetail ──────────────────────────────────────────────
/**
 * Ambil detail satu responden berdasarkan id (SE26-XXXX).
 */
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

// ── Hook: usePetugas ─────────────────────────────────────────────────────
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

// ── Hook: useKecamatan ────────────────────────────────────────────────────
export function useKecamatan() {
  const [state, setState] = useState({ data: [], loading: true, error: null });
  useEffect(() => {
    apiFetch('/api/kecamatan')
      .then(data => setState({ data, loading: false, error: null }))
      .catch(err => setState({ data: [], loading: false, error: err.message }));
  }, []);
  return state;
}
