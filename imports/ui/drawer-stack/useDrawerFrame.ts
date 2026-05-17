import { useContext } from 'react';
import { FrameContext } from './DrawerStackProvider';

export interface DrawerFrame<R, M> {
  model: M;
  resolve: (value: R | undefined) => void;
  cancel: () => void;
}

export default function useDrawerFrame<R = unknown, M = unknown>(): DrawerFrame<R, M> {
  const frame = useContext(FrameContext);
  if (frame === null) {
    throw new Error('useDrawerFrame must be used inside a frame rendered by <DrawerStackProvider>.');
  }
  return {
    model: frame.model as M,
    resolve: value => frame.resolve(value),
    cancel: frame.cancel,
  };
}
