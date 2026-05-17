import { useContext } from 'react';
import { FrameContext } from './DrawerStackProvider';
import type { ConfirmClosePredicate } from './types';

export default function useConfirmClose(predicate: ConfirmClosePredicate): void {
  const frame = useContext(FrameContext);
  if (frame === null) {
    throw new Error('useConfirmClose must be used inside a frame rendered by <DrawerStackProvider>.');
  }
  // Assigned on every render so a predicate that captures dirty state via
  // closure always reflects the latest values without `useCallback`.
  frame.confirmCloseRef.current = predicate;
}
