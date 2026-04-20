import type { ReactNode } from 'react';

export interface DrawerContextValue {
  drawerOpen: boolean;
  drawerTitle: string;
  drawerModel: Record<string, unknown>;
  drawerComponent: ReactNode;
  drawerExtra: ReactNode;
  setDrawerOpen: (open: boolean) => void;
  setDrawerTitle: (title: string) => void;
  setDrawerModel: (model: Record<string, unknown>) => void;
  setDrawerComponent: (component: ReactNode) => void;
  setDrawerExtra: (extra: ReactNode) => void;
}
