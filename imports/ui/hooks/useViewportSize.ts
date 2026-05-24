import { useEffect, useState } from 'react';

export interface ViewportSize {
  width: number;
  height: number;
}

function readViewport(): ViewportSize {
  if (typeof window === 'undefined') {
    return { width: 0, height: 0 };
  }
  return { width: window.innerWidth, height: window.innerHeight };
}

/**
 * Reactive viewport size. Updates on `resize` and `orientationchange` (debounced
 * to avoid thrashing during a continuous drag), so width-dependent UI — the
 * unsupported-device gate, drawer width, modal width — recomputes on resize and
 * rotation instead of being frozen at the value read on first render.
 */
export default function useViewportSize(debounceMs = 150): ViewportSize {
  const [size, setSize] = useState<ViewportSize>(readViewport);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const handleChange = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setSize(readViewport()), debounceMs);
    };
    // Sync once on mount in case the viewport changed before listeners attached.
    setSize(readViewport());
    window.addEventListener('resize', handleChange);
    window.addEventListener('orientationchange', handleChange);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('resize', handleChange);
      window.removeEventListener('orientationchange', handleChange);
    };
  }, [debounceMs]);

  return size;
}
