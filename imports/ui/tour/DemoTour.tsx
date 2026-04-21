import { Tour } from 'antd';
import type { TourStepProps } from 'antd';
import React, { useCallback, useContext, useMemo, useRef } from 'react';
import { useTranslation } from '../../i18n/LanguageContext';
import useNavigation from '../navigation/navigation.hook';
import TourContext from './TourContext';
import getTourSteps from './tourSteps';

type TargetFn = () => HTMLElement | null | undefined;

function pollForStableElement(targetFn: TargetFn, timeoutMs = 3000, intervalMs = 50, stableMs = 200): Promise<HTMLElement | null> {
  return new Promise<HTMLElement | null>(resolve => {
    const start = Date.now();
    let lastRect: DOMRect | null = null;
    let stableSince: number | null = null;

    const check = () => {
      if (Date.now() - start >= timeoutMs) return resolve(lastRect ? targetFn() ?? null : null);

      const el = targetFn();
      if (!el) {
        lastRect = null;
        stableSince = null;
        return setTimeout(check, intervalMs);
      }

      const rect = el.getBoundingClientRect();
      const same = lastRect && rect.width === lastRect.width && rect.height === lastRect.height;

      if (same) {
        if (stableSince !== null && Date.now() - stableSince >= stableMs) return resolve(el);
      } else {
        lastRect = rect;
        stableSince = Date.now();
      }

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
    (page: string) => {
      setNavigationValue(page);
      window.history.pushState(null, '', `${window.location.origin}/${page}`);
    },
    [setNavigationValue]
  );

  const handleChange = useCallback(
    async (nextStep: number) => {
      if (transitioning.current) return;
      if (nextStep < 0 || nextStep >= steps.length) return;
      transitioning.current = true;

      try {
        const prevStep = steps[currentStep];
        const step = steps[nextStep];
        const needsNavigation = step.page !== null && step.page !== navigationValue;

        if (prevStep?.cleanup) {
          prevStep.cleanup(actions);
        }

        if (needsNavigation && step.page !== null) {
          setOpen(false);
          navigate(step.page);
        }

        if (step.action) {
          if (needsNavigation) {
            await new Promise(r => setTimeout(r, 300));
          }
          await step.action(actions);
        }

        if (step.target) {
          await pollForStableElement(step.target, 3000, 50, 200);
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

  return (
    <Tour
      open={open}
      current={currentStep}
      onChange={handleChange}
      onClose={handleClose}
      steps={steps as unknown as TourStepProps[]}
      scrollIntoViewOptions={{ behavior: 'smooth', block: 'center' }}
    />
  );
}
