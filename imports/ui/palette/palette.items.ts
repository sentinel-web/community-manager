import type { Role } from '../../api/types';
import { hasAccess } from '../navigation/Navigation';
import type { PaletteItem } from './palette.types';

type Translator = (key: string) => string;

interface NavConfig {
  key: string;
  module: keyof Role;
  labelKey: string;
}

const NAV_ROUTES: NavConfig[] = [
  { key: 'dashboard', module: 'dashboard', labelKey: 'navigation.dashboard' },
  { key: 'orbat', module: 'orbat', labelKey: 'navigation.orbat' },
  { key: 'events', module: 'events', labelKey: 'navigation.events' },
  { key: 'eventTypes', module: 'eventTypes', labelKey: 'navigation.eventTypes' },
  { key: 'tasks', module: 'tasks', labelKey: 'navigation.tasks' },
  { key: 'taskStatus', module: 'taskStatus', labelKey: 'navigation.taskStatus' },
  { key: 'squads', module: 'squads', labelKey: 'navigation.squads' },
  { key: 'members', module: 'members', labelKey: 'navigation.members' },
  { key: 'ranks', module: 'ranks', labelKey: 'navigation.ranks' },
  { key: 'specializations', module: 'specializations', labelKey: 'navigation.specializations' },
  { key: 'medals', module: 'medals', labelKey: 'navigation.medals' },
  { key: 'positions', module: 'positions', labelKey: 'navigation.positions' },
  { key: 'registrations', module: 'registrations', labelKey: 'navigation.registrations' },
  { key: 'discoveryTypes', module: 'discoveryTypes', labelKey: 'navigation.discoveryTypes' },
  { key: 'roles', module: 'roles', labelKey: 'navigation.roles' },
  { key: 'logs', module: 'logs', labelKey: 'navigation.logs' },
  { key: 'settings', module: 'settings', labelKey: 'navigation.settings' },
  { key: 'backup', module: 'settings', labelKey: 'navigation.backup' },
];

export function getNavigatePaletteItems(role: Role | undefined, t: Translator, navigate: (route: string) => void): PaletteItem[] {
  if (!role) return [];
  const groupLabel = t('palette.navigate');
  return NAV_ROUTES.filter(route => hasAccess(role, route.module)).map(route => ({
    kind: 'navigate' as const,
    key: `nav:${route.key}`,
    label: t(route.labelKey),
    group: groupLabel,
    onSelect: () => navigate(route.key),
  }));
}
