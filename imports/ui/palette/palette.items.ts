import type { Role } from '../../api/types';
import { hasAccess } from '../navigation/Navigation';
import type { PaletteItem } from './palette.types';

type Translator = (key: string) => string;

export interface PaletteEntityResults {
  members: Array<{ _id: string; username?: string; profile?: { name?: string; id?: number } }>;
  events: Array<{ _id: string; name: string }>;
  tasks: Array<{ _id: string; name: string }>;
  squads: Array<{ _id: string; name: string }>;
  registrations: Array<{ _id: string; name: string }>;
  questionnaires: Array<{ _id: string; name: string }>;
}

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

interface CreateActionConfig {
  module: keyof Role;
  route: string;
  labelKey: string;
}

const CREATE_ACTIONS: CreateActionConfig[] = [
  { module: 'members', route: 'members', labelKey: 'palette.createMember' },
  { module: 'events', route: 'events', labelKey: 'palette.createEvent' },
  { module: 'tasks', route: 'tasks', labelKey: 'palette.createTask' },
  { module: 'squads', route: 'squads', labelKey: 'palette.createSquad' },
  { module: 'registrations', route: 'registrations', labelKey: 'palette.createRegistration' },
  { module: 'questionnaires', route: 'questionnaires', labelKey: 'palette.createQuestionnaire' },
];

function hasCreateAccess(role: Role | undefined, module: keyof Role): boolean {
  if (!role) return false;
  if (role.roles === true) return true;
  const permission = role[module];
  if (permission === true) return true;
  if (typeof permission === 'object' && permission !== null) {
    return (permission as { create?: boolean }).create === true;
  }
  return false;
}

export interface GlobalActionHandlers {
  switchLanguage: () => void;
  toggleTheme: () => void;
  logout: () => void;
}

export function getGlobalPaletteItems(t: Translator, handlers: GlobalActionHandlers): PaletteItem[] {
  const groupLabel = t('palette.actions');
  return [
    {
      kind: 'action',
      key: 'action:switch-language',
      label: t('palette.switchLanguage'),
      group: groupLabel,
      onSelect: handlers.switchLanguage,
    },
    {
      kind: 'action',
      key: 'action:toggle-theme',
      label: t('palette.toggleTheme'),
      group: groupLabel,
      onSelect: handlers.toggleTheme,
    },
    {
      kind: 'action',
      key: 'action:logout',
      label: t('palette.logout'),
      group: groupLabel,
      onSelect: handlers.logout,
    },
  ];
}

export function getCreatePaletteItems(
  role: Role | undefined,
  t: Translator,
  navigateWithAction: (route: string, action: string) => void
): PaletteItem[] {
  if (!role) return [];
  const groupLabel = t('palette.actions');
  return CREATE_ACTIONS.filter(action => hasCreateAccess(role, action.module)).map(action => ({
    kind: 'action' as const,
    key: `action:create:${action.route}`,
    label: t(action.labelKey),
    group: groupLabel,
    onSelect: () => navigateWithAction(action.route, 'create'),
  }));
}

export function getEntityPaletteItems(results: PaletteEntityResults, t: Translator, navigate: (route: string) => void): PaletteItem[] {
  const items: PaletteItem[] = [];

  results.members.forEach(m => {
    const label = m.profile?.name || m.username || m._id;
    items.push({
      kind: 'entity',
      key: `entity:members:${m._id}`,
      label,
      group: t('palette.members'),
      onSelect: () => navigate('members'),
    });
  });
  results.events.forEach(e => {
    items.push({
      kind: 'entity',
      key: `entity:events:${e._id}`,
      label: e.name,
      group: t('palette.events'),
      onSelect: () => navigate('events'),
    });
  });
  results.tasks.forEach(task => {
    items.push({
      kind: 'entity',
      key: `entity:tasks:${task._id}`,
      label: task.name,
      group: t('palette.tasks'),
      onSelect: () => navigate('tasks'),
    });
  });
  results.squads.forEach(s => {
    items.push({
      kind: 'entity',
      key: `entity:squads:${s._id}`,
      label: s.name,
      group: t('palette.squads'),
      onSelect: () => navigate('squads'),
    });
  });
  results.registrations.forEach(r => {
    items.push({
      kind: 'entity',
      key: `entity:registrations:${r._id}`,
      label: r.name,
      group: t('palette.registrations'),
      onSelect: () => navigate('registrations'),
    });
  });
  results.questionnaires.forEach(q => {
    items.push({
      kind: 'entity',
      key: `entity:questionnaires:${q._id}`,
      label: q.name,
      group: t('palette.questionnaires'),
      onSelect: () => navigate('questionnaires'),
    });
  });

  return items;
}

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
