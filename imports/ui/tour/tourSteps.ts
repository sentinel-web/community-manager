import type { LanguageContextValue } from '../../i18n/LanguageContext';
import type { TourContextValue } from './TourContext';

type TranslateFn = LanguageContextValue['t'];
type RefsRef = TourContextValue['refs'];
type ActionsRef = TourContextValue['actions'];

export interface TourStep {
  title: string;
  description: string;
  target: () => HTMLElement | null | undefined;
  page: string | null;
  refKey: string;
  action?: (actions: ActionsRef) => void | Promise<void>;
  cleanup?: (actions: ActionsRef) => void;
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

export default function getTourSteps(t: TranslateFn, refs: RefsRef, actions: ActionsRef): TourStep[] {
  return [
    {
      title: t('tour.step1Title'),
      description: t('tour.step1Description'),
      target: () => refs.current['dashboard-stats']?.current,
      page: 'dashboard',
      refKey: 'dashboard-stats',
    },
    {
      title: t('tour.step2Title'),
      description: t('tour.step2Description'),
      target: () => refs.current['members-table']?.current,
      page: 'members',
      refKey: 'members-table',
    },
    {
      title: t('tour.step3Title'),
      description: t('tour.step3Description'),
      target: () => refs.current['members-expanded']?.current,
      page: 'members',
      refKey: 'members-expanded',
      action: async () => {
        const expandBtn = document.querySelector<HTMLElement>('.ant-table-row-expand-icon');
        if (expandBtn) {
          expandBtn.click();
          await sleep(300);
        }
      },
      cleanup: () => {
        const expandBtn = document.querySelector<HTMLElement>('.ant-table-row-expand-icon-expanded');
        if (expandBtn) expandBtn.click();
      },
    },
    {
      title: t('tour.step4Title'),
      description: t('tour.step4Description'),
      target: () => refs.current['squads-section']?.current,
      page: 'squads',
      refKey: 'squads-section',
    },
    {
      title: t('tour.step5Title'),
      description: t('tour.step5Description'),
      target: () => refs.current['orbat-chart']?.current,
      page: 'orbat',
      refKey: 'orbat-chart',
    },
    {
      title: t('tour.step6Title'),
      description: t('tour.step6Description'),
      target: () => refs.current['ranks-section']?.current,
      page: 'ranks',
      refKey: 'ranks-section',
    },
    {
      title: t('tour.step7Title'),
      description: t('tour.step7Description'),
      target: () => refs.current['specializations-section']?.current,
      page: 'specializations',
      refKey: 'specializations-section',
    },
    {
      title: t('tour.step8Title'),
      description: t('tour.step8Description'),
      target: () => refs.current['medals-section']?.current,
      page: 'medals',
      refKey: 'medals-section',
    },
    {
      title: t('tour.step9Title'),
      description: t('tour.step9Description'),
      target: () => refs.current['events-calendar']?.current,
      page: 'events',
      refKey: 'events-calendar',
      action: async actionsRef => {
        actionsRef.current['events-switch-calendar']?.();
        await sleep(300);
      },
    },
    {
      title: t('tour.step10Title'),
      description: t('tour.step10Description'),
      target: () => refs.current['events-attendance']?.current,
      page: 'events',
      refKey: 'events-attendance',
      action: async actionsRef => {
        actionsRef.current['events-switch-attendance']?.();
        await sleep(300);
      },
      cleanup: actionsRef => {
        actionsRef.current['events-switch-calendar']?.();
      },
    },
    {
      title: t('tour.step11Title'),
      description: t('tour.step11Description'),
      target: () => refs.current['tasks-section']?.current,
      page: 'tasks',
      refKey: 'tasks-section',
    },
    {
      title: t('tour.step12Title'),
      description: t('tour.step12Description'),
      target: () => refs.current['questionnaires-section']?.current,
      page: 'questionnaires',
      refKey: 'questionnaires-section',
    },
    {
      title: t('tour.step13Title'),
      description: t('tour.step13Description'),
      target: () => refs.current['registrations-section']?.current,
      page: 'registrations',
      refKey: 'registrations-section',
    },
    {
      title: t('tour.step14Title'),
      description: t('tour.step14Description'),
      target: () => refs.current['roles-section']?.current,
      page: 'roles',
      refKey: 'roles-section',
    },
    {
      title: t('tour.step15Title'),
      description: t('tour.step15Description'),
      target: () => refs.current['settings-section']?.current,
      page: 'settings',
      refKey: 'settings-section',
    },
    {
      title: t('tour.step16Title'),
      description: t('tour.step16Description'),
      target: () => refs.current['logs-section']?.current,
      page: 'logs',
      refKey: 'logs-section',
    },
    {
      title: t('tour.step17Title'),
      description: t('tour.step17Description'),
      target: () => refs.current['backup-section']?.current,
      page: 'backup',
      refKey: 'backup-section',
    },
    {
      title: t('tour.step18Title'),
      description: t('tour.step18Description'),
      target: () => refs.current['header-controls']?.current,
      page: null,
      refKey: 'header-controls',
    },
  ];
}
