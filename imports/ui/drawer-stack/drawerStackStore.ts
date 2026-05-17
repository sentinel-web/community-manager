import type { ConfirmCloseRef, InternalFrame, PushFrameOptions } from './types';

export interface DrawerStackStore {
  push: <R = unknown, M = unknown>(options: PushFrameOptions<M>) => Promise<R | undefined>;
  resolveFrame: (frameId: number, value: unknown) => void;
  cancelFrame: (frameId: number) => void;
  tryClose: (frameId: number) => Promise<void>;
  getSnapshot: () => readonly InternalFrame[];
  subscribe: (listener: () => void) => () => void;
}

export function createDrawerStackStore(): DrawerStackStore {
  let frames: InternalFrame[] = [];
  const listeners = new Set<() => void>();
  let nextId = 1;

  function emit() {
    for (const listener of listeners) {
      listener();
    }
  }

  function settle(frame: InternalFrame, value: unknown) {
    if (frame.settled) return;
    frame.settled = true;
    frame.resolveFn(value);
  }

  function dropFromIndex(idx: number, valueForTarget: unknown) {
    // Cascade-down: frames above the target resolve with undefined first
    // (top-to-bottom), then the target itself resolves with its value.
    // Per PRD: "frames K+1..N also fulfil with undefined before K's
    // resolution settles".
    for (let i = frames.length - 1; i > idx; i--) {
      settle(frames[i], undefined);
    }
    settle(frames[idx], valueForTarget);
    frames = frames.slice(0, idx);
    emit();
  }

  function push<R, M>(options: PushFrameOptions<M>): Promise<R | undefined> {
    return new Promise<R | undefined>(resolve => {
      const id = nextId++;
      const confirmCloseRef: ConfirmCloseRef = { current: null };
      const frame: InternalFrame = {
        id,
        title: options.title,
        Component: options.Component,
        model: options.model,
        extra: options.extra ?? null,
        confirmCloseRef,
        resolveFn: value => resolve(value as R | undefined),
        settled: false,
      };
      frames = [...frames, frame];
      emit();
    });
  }

  function resolveFrame(frameId: number, value: unknown) {
    const idx = frames.findIndex(f => f.id === frameId);
    if (idx === -1) return;
    dropFromIndex(idx, value);
  }

  function cancelFrame(frameId: number) {
    resolveFrame(frameId, undefined);
  }

  async function tryClose(frameId: number): Promise<void> {
    // User-initiated close. PRD: "Only the top frame is interactive, so only
    // the top frame's predicate is ever consulted on the user path." We
    // defensively ignore close attempts on non-top frames.
    const top = frames[frames.length - 1];
    if (!top || top.id !== frameId) return;
    const predicate = top.confirmCloseRef.current;
    if (predicate) {
      const allowed = await predicate();
      if (allowed === false) return;
    }
    cancelFrame(frameId);
  }

  function getSnapshot(): readonly InternalFrame[] {
    return frames;
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  return { push, resolveFrame, cancelFrame, tryClose, getSnapshot, subscribe };
}
