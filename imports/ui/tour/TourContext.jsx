import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';

const TourContext = createContext({});

export function TourProvider({ children }) {
  const refsMap = useRef({});
  const actionsMap = useRef({});
  const [open, setOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const registerRef = useCallback((key, ref) => {
    refsMap.current[key] = ref;
  }, []);

  const unregisterRef = useCallback(key => {
    delete refsMap.current[key];
  }, []);

  const registerAction = useCallback((key, fn) => {
    actionsMap.current[key] = fn;
  }, []);

  const unregisterAction = useCallback(key => {
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

  const value = useMemo(
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
TourProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export function useTourRef(key) {
  const ref = useRef(null);
  const { registerRef, unregisterRef } = useContext(TourContext);

  useEffect(() => {
    registerRef(key, ref);
    return () => unregisterRef(key);
  }, [key, registerRef, unregisterRef]);

  return ref;
}

export function useTourAction(key, fn) {
  const { registerAction, unregisterAction } = useContext(TourContext);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    registerAction(key, (...args) => fnRef.current(...args));
    return () => unregisterAction(key);
  }, [key, registerAction, unregisterAction]);
}

export default TourContext;
