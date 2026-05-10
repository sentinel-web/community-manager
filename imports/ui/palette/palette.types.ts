import type { ReactNode } from 'react';

export type PaletteItemKind = 'navigate' | 'action' | 'entity';

export interface PaletteItem {
  kind: PaletteItemKind;
  key: string;
  label: string;
  icon?: ReactNode;
  group: string;
  onSelect: () => void;
}

export interface PaletteGroup {
  key: string;
  label: string;
  items: PaletteItem[];
}
