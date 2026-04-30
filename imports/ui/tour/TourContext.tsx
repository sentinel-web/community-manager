import React, { createContext, MutableRefObject, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

export type TourElementRef = MutableRefObject<HTMLElement | null>;
export type TourActionFn = (...args: unknown[]) => unknown;

type RefsMap = Record<string, TourElementRef>;
type ActionsMap = Record<string, TourActionFn>;

export interface TourContextValue {
  refs: MutableRefObject<RefsMap>;
  actions: MutableRefObject<ActionsMap>;
  open: boolean;
  currentStep: number;
  registerRef: (key: string, ref: TourElementRef) => void;
  unregisterRef: (key: string) => void;
  registerAction: (key: string, fn: TourActionFn) => void;
  unregisterAction: (key: string) => void;
  setOpen: (open: boolean) => void;
  setCurrentStep: (step: number) => void;
  startTour: () => void;
  stopTour: () => void;
}

const TourContext = createContext<TourContextValue>({} as TourContextValue);

interface TourProviderProps {
  children: ReactNode;
}

export function TourProvider({ children }: TourProviderProps) {
  const refsMap = useRef<RefsMap>({});
  const actionsMap = useRef<ActionsMap>({});
  const [open, setOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const registerRef = useCallback((key: string, ref: TourElementRef) => {
    refsMap.current[key] = ref;
  }, []);

  const unregisterRef = useCallback((key: string) => {
    delete refsMap.current[key];
  }, []);

  const registerAction = useCallback((key: string, fn: TourActionFn) => {
    actionsMap.current[key] = fn;
  }, []);

  const unregisterAction = useCallback((key: string) => {
    delete actionsMap.current[key];
  }, []);

  const startTour = useCallback(() => {
    setCurrentStep(0);
    setOpen(true);
  }, []);

  const stopTour = useCallback(() => {
    setOpen(false);
    setCurrentStep(0);
  }, []);

  const value = useMemo<TourContextValue>(
    () => ({
      refs: refsMap,
      actions: actionsMap,
      open,
      currentStep,
      registerRef,
      unregisterRef,
      registerAction,
      unregisterAction,
      setOpen,
      setCurrentStep,
      startTour,
      stopTour,
    }),
    [open, currentStep, registerRef, unregisterRef, registerAction, unregisterAction, startTour, stopTour]
  );

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useTourRef<T extends HTMLElement = HTMLDivElement>(key: string): MutableRefObject<T | null> {
  const ref = useRef<T | null>(null);
  const { registerRef, unregisterRef } = useContext(TourContext);

  useEffect(() => {
    registerRef(key, ref as MutableRefObject<HTMLElement | null>);
    return () => unregisterRef(key);
  }, [key, registerRef, unregisterRef]);

  return ref;
}

export function useTourAction(key: string, fn: TourActionFn): void {
  const { registerAction, unregisterAction } = useContext(TourContext);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    registerAction(key, (...args) => fnRef.current(...args));
    return () => unregisterAction(key);
  }, [key, registerAction, unregisterAction]);
}

export default TourContext;
