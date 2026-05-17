import { useContext } from 'react';
import { DrawerStackContext } from './DrawerStackProvider';
import type { DrawerStackApi } from './types';

export default function useDrawerStack(): DrawerStackApi {
  const api = useContext(DrawerStackContext);
  if (api === null) {
    throw new Error('useDrawerStack must be used inside a <DrawerStackProvider>.');
  }
  return api;
}
