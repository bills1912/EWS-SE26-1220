/**
 * src/context/KecamatanContext.jsx
 * =================================
 * Context global filter kecamatan — satu pilihan berlaku ke semua halaman.
 */
import { createContext, useContext, useState } from 'react';

const KecamatanContext = createContext(null);

const KECAMATAN_LIST = [
  'PADANG BOLAK', 'SIMANGAMBAT', 'PORTIBI', 'HALONGONAN TIMUR',
  'DOLOK', 'HALONGONAN', 'BATANG ONANG', 'DOLOK SIGOMPULON',
  'PADANG BOLAK JULU', 'PADANG BOLAK TENGGARA', 'UJUNG BATU', 'HULU SIHAPAS',
];

export function KecamatanProvider({ children }) {
  const [selectedKec, setSelectedKec] = useState('all'); // 'all' atau nama kecamatan
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
