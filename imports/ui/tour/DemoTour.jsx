import { Tour } from 'antd';
import React, { useCallback, useContext, useMemo, useRef } from 'react';
import { useTranslation } from '../../i18n/LanguageContext';
import useNavigation from '../navigation/navigation.hook';
import TourContext from './TourContext';
import getTourSteps from './tourSteps';

function pollForElement(targetFn, timeoutMs = 3000, intervalMs = 50) {
  return new Promise(resolve => {
    const start = Date.now();
    const check = () => {
      const el = targetFn();
      if (el) return resolve(el);
      if (Date.now() - start >= timeoutMs) return resolve(null);
      setTimeout(check, intervalMs);
    };
    check();
  });
}

export default function DemoTour() {
  const { refs, actions, open, currentStep, setOpen, setCurrentStep, stopTour } = useContext(TourContext);
  const { navigationValue, setNavigationValue } = useNavigation();
  const { t } = useTranslation();
  const transitioning = useRef(false);

  const steps = useMemo(() => getTourSteps(t, refs, actions), [t, refs, actions]);

  const navigate = useCallback(
    page => {
      setNavigationValue(page);
      window.history.pushState(null, null, `${window.location.origin}/${page}`);
    },
    [setNavigationValue]
  );

  const handleChange = useCallback(
    async nextStep => {
      if (transitioning.current) return;
      if (nextStep < 0 || nextStep >= steps.length) return;
      transitioning.current = true;

      try {
        const prevStep = steps[currentStep];
        const step = steps[nextStep];
        const needsNavigation = step.page !== null && step.page !== navigationValue;

        // Run cleanup on previous step
        if (prevStep?.cleanup) {
          prevStep.cleanup(actions);
        }

        // Navigate if needed
        if (needsNavigation) {
          setOpen(false);
          navigate(step.page);
        }

        // Run action if defined
        if (step.action) {
          // Brief delay for page mount after navigation
          if (needsNavigation) {
            await new Promise(r => setTimeout(r, 300));
          }
          await step.action(actions);
        }

        // Poll for target element
        if (step.target) {
          await pollForElement(step.target, 3000, 50);
        }

        setCurrentStep(nextStep);
        setOpen(true);
      } finally {
        transitioning.current = false;
      }
    },
    [steps, currentStep, navigationValue, navigate, setOpen, setCurrentStep, actions]
  );

  const handleClose = useCallback(() => {
    const prevStep = steps[currentStep];
    if (prevStep?.cleanup) {
      prevStep.cleanup(actions);
    }
    stopTour();
  }, [steps, currentStep, actions, stopTour]);

  if (!open) return null;

  return <Tour open={open} current={currentStep} onChange={handleChange} onClose={handleClose} steps={steps} />;
}
