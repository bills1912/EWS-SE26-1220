/**
 * src/hooks/useBreakpoint.js
 * ──────────────────────────
 * Hook deteksi ukuran layar, reaktif terhadap resize/orientation change.
 * Dipakai di seluruh app karena styling di codebase ini 100% inline style
 * (bukan CSS classes/Tailwind) — jadi breakpoint di-handle lewat JS
 * (kondisional inline style), bukan lewat @media CSS.
 *
 * Breakpoint:
 *   mobile  : <= 640px   (HP)
 *   tablet  : 641–1024px (tablet / HP landscape besar)
 *   desktop : > 1024px
 *
 * Pemakaian:
 *   const { isMobile, isTablet, isDesktop, width } = useBreakpoint();
 *   const isMobileOrTablet = useBreakpoint().isMobile || useBreakpoint().isTablet;
 *   // atau, kalau cuma butuh 1 boolean gabungan mobile+tablet:
 *   const isCompact = useIsCompact(); // <= 1024px
 */
import { useState, useEffect } from 'react';

const MOBILE_MAX  = 640;
const TABLET_MAX  = 1024;

function getSnapshot() {
  if (typeof window === 'undefined') {
    return { width: 1280, isMobile: false, isTablet: false, isDesktop: true };
  }
  const width = window.innerWidth;
  return {
    width,
    isMobile:  width <= MOBILE_MAX,
    isTablet:  width > MOBILE_MAX && width <= TABLET_MAX,
    isDesktop: width > TABLET_MAX,
  };
}

export function useBreakpoint() {
  const [state, setState] = useState(getSnapshot);

  useEffect(() => {
    let raf = null;
    const onResize = () => {
      // rAF-throttle biar tidak re-render bertubi-tubi tiap px saat drag-resize
      if (raf) return;
      raf = requestAnimationFrame(() => {
        setState(getSnapshot());
        raf = null;
      });
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return state;
}

/** Shortcut: true kalau layar <= 640px (HP) */
export function useIsMobile() {
  return useBreakpoint().isMobile;
}

/** Shortcut: true kalau layar <= 1024px (HP ATAU tablet) — dipakai utk
 * keputusan "kompak vs penuh" yang sama berlaku di HP maupun tablet
 * (mis. sembunyikan kolom tabel, pakai tampilan kartu, dst) */
export function useIsCompact() {
  const { isMobile, isTablet } = useBreakpoint();
  return isMobile || isTablet;
}
