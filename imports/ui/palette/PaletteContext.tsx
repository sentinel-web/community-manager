import React, { createContext, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';

export interface PaletteContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

export const PaletteContext = createContext<PaletteContextValue>({} as PaletteContextValue);

interface PaletteProviderProps {
  children: ReactNode;
}

export function PaletteProvider({ children }: PaletteProviderProps) {
  const [open, setOpen] = useState(false);

  const toggle = useCallback(() => setOpen(prev => !prev), []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const value = useMemo<PaletteContextValue>(() => ({ open, setOpen, toggle }), [open, toggle]);

  return <PaletteContext.Provider value={value}>{children}</PaletteContext.Provider>;
}
