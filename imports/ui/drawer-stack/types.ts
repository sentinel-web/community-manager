import type { ComponentType, ReactNode } from 'react';

export type ConfirmClosePredicate = () => boolean | Promise<boolean>;

export type ConfirmCloseRef = { current: ConfirmClosePredicate | null };

export interface PushFrameOptions<M = unknown> {
  title: string;
  Component: ComponentType<unknown>;
  model: M;
  extra?: ReactNode;
}

export interface InternalFrame {
  id: number;
  title: string;
  Component: ComponentType<unknown>;
  model: unknown;
  extra: ReactNode;
  confirmCloseRef: ConfirmCloseRef;
  resolveFn: (value: unknown) => void;
  settled: boolean;
}

export interface FrameContextValue {
  model: unknown;
  resolve: (value: unknown) => void;
  cancel: () => void;
  confirmCloseRef: ConfirmCloseRef;
  // DOM node of this frame's Drawer footer slot, into which FormFooter portals
  // its action buttons so they pin to the bottom of the drawer. Null until the
  // Drawer mounts the slot.
  footerContainer: HTMLElement | null;
}

export interface DrawerStackApi {
  push: <R = unknown, M = unknown>(options: PushFrameOptions<M>) => Promise<R | undefined>;
}
