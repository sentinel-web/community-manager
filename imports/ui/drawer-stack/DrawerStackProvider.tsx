import { Drawer } from 'antd';
import React, { createContext, ReactNode, useCallback, useMemo, useRef, useSyncExternalStore } from 'react';
import { getDrawerWidth } from '../../config';
import { createDrawerStackStore, type DrawerStackStore } from './drawerStackStore';
import type { DrawerStackApi, FrameContextValue, InternalFrame, PushFrameOptions } from './types';

export const DrawerStackContext = createContext<DrawerStackApi | null>(null);
export const FrameContext = createContext<FrameContextValue | null>(null);

interface DrawerStackProviderProps {
  children: ReactNode;
}

export default function DrawerStackProvider({ children }: DrawerStackProviderProps) {
  const storeRef = useRef<DrawerStackStore | null>(null);
  if (storeRef.current === null) {
    storeRef.current = createDrawerStackStore();
  }
  const store = storeRef.current;

  const frames = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

  const push = useCallback(
    <R = unknown, M = unknown>(options: PushFrameOptions<M>) => store.push<R, M>(options),
    [store]
  );

  const api = useMemo<DrawerStackApi>(() => ({ push }), [push]);

  return (
    <DrawerStackContext.Provider value={api}>
      {children}
      <DrawerStackFrames frames={frames} store={store} />
    </DrawerStackContext.Provider>
  );
}

interface DrawerStackFramesProps {
  frames: readonly InternalFrame[];
  store: DrawerStackStore;
}

function DrawerStackFrames({ frames, store }: DrawerStackFramesProps) {
  return <FrameRenderer frames={frames} index={0} store={store} />;
}

interface FrameRendererProps {
  frames: readonly InternalFrame[];
  index: number;
  store: DrawerStackStore;
}

function FrameRenderer({ frames, index, store }: FrameRendererProps) {
  if (index >= frames.length) return null;
  const frame = frames[index];
  const isTop = index === frames.length - 1;
  return (
    <FrameDrawer frame={frame} isTop={isTop} store={store}>
      <FrameRenderer frames={frames} index={index + 1} store={store} />
    </FrameDrawer>
  );
}

interface FrameDrawerProps {
  frame: InternalFrame;
  isTop: boolean;
  store: DrawerStackStore;
  children: ReactNode;
}

function FrameDrawer({ frame, isTop, store, children }: FrameDrawerProps) {
  const handleClose = useCallback(() => {
    void store.tryClose(frame.id);
  }, [store, frame.id]);

  const frameApi = useMemo<FrameContextValue>(
    () => ({
      model: frame.model,
      resolve: value => store.resolveFrame(frame.id, value),
      cancel: () => store.cancelFrame(frame.id),
      confirmCloseRef: frame.confirmCloseRef,
    }),
    [store, frame.id, frame.model, frame.confirmCloseRef]
  );

  const Component = frame.Component;

  return (
    <Drawer
      width={getDrawerWidth(window.innerWidth)}
      open={true}
      onClose={handleClose}
      title={frame.title}
      extra={frame.extra}
      maskClosable={isTop}
      destroyOnHidden
    >
      <FrameContext.Provider value={frameApi}>
        <Component />
      </FrameContext.Provider>
      {children}
    </Drawer>
  );
}
