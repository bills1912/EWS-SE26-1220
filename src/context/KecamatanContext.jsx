/**
 * src/context/KecamatanContext.jsx
 * ─────────────────────────────────
 * PENTING: nama kecamatan harus EXACT MATCH dengan field "kec" di MongoDB
 * (disimpan dalam format Titlecase oleh upload_to_mongo.py via kec_order list)
 */
import { createContext, useContext, useState } from 'react';

const KecamatanContext = createContext(null);

// Titlecase — HARUS sama persis dengan kec_order di upload_to_mongo.py
export const KECAMATAN_LIST = [
  'Padang Bolak',
  'Simangambat',
  'Portibi',
  'Halongonan Timur',
  'Dolok',
  'Halongonan',
  'Batang Onang',
  'Dolok Sigompulon',
  'Padang Bolak Julu',
  'Padang Bolak Tenggara',
  'Ujung Batu',
  'Hulu Sihapas',
];

export function KecamatanProvider({ children }) {
  const [selectedKec, setSelectedKec] = useState('all');
  return (
    <KecamatanContext.Provider value={{ selectedKec, setSelectedKec, KECAMATAN_LIST }}>
      {children}
    </KecamatanContext.Provider>
  );
}

export const useKecamatan = () => {
  const ctx = useContext(KecamatanContext);
  if (!ctx) throw new Error('useKecamatan harus dalam KecamatanProvider');
  return ctx;
};