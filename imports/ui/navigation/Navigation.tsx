import {
  AimOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  CloudServerOutlined,
  ClusterOutlined,
  DashboardOutlined,
  FileTextOutlined,
  FormOutlined,
  IdcardOutlined,
  MenuOutlined,
  OrderedListOutlined,
  SettingOutlined,
  SnippetsOutlined,
  SolutionOutlined,
  TagOutlined,
  TagsOutlined,
  TeamOutlined,
  TrophyOutlined,
  UserAddOutlined,
  UsergroupAddOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Button, Dropdown, Grid, Tooltip } from 'antd';
import type { MenuProps } from 'antd';
import { Meteor } from 'meteor/meteor';
import { useFind, useSubscribe, useTracker } from 'meteor/react-meteor-data';
import React, { useCallback, useEffect, useMemo } from 'react';
import RolesCollection from '../../api/collections/roles.collection';
import type { Role } from '../../api/types';
import useNavigation from './navigation.hook';
import { useTranslation } from '../../i18n/LanguageContext';
import useUserMenu from '../components/useUserMenu';

// Keys handled as user actions (in the mobile menu) rather than navigation.
const USER_ACTION_KEYS = new Set(['profile', 'changePassword', 'logout']);

type PermissionModule = keyof Role;

function getPaletteShortcutLabel(): string {
  if (typeof navigator === 'undefined') return 'Ctrl K';
  const isMac = /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent || '');
  return isMac ? '⌘ K' : 'Ctrl K';
}

export function hasAccess(role: Role | undefined, module: PermissionModule): boolean {
  if (!role) return false;

  if (role.roles === true) return true;

  const permission = role[module];

  if (permission === true) return true;
  if (permission === false || permission === undefined) return false;

  if (typeof permission === 'object' && permission !== null) {
    return permission.read === true;
  }

  return false;
}

export function getNavigationValue(): string {
  const pathname = window.location.pathname;
  if (pathname === '/') {
    return 'dashboard';
  }
  if (pathname.includes('/dashboard')) {
    return 'dashboard';
  }
  if (pathname.includes('/orbat')) {
    return 'orbat';
  }
  if (pathname.includes('/events')) {
    return 'events';
  }
  if (pathname.includes('/eventTypes')) {
    return 'eventTypes';
  }
  if (pathname.includes('/briefingTemplates')) {
    return 'briefingTemplates';
  }
  if (pathname.includes('/tasks')) {
    return 'tasks';
  }
  if (pathname.includes('/taskStatus')) {
    return 'taskStatus';
  }
  if (pathname.includes('/squads')) {
    return 'squads';
  }
  if (pathname.includes('/members')) {
    return 'members';
  }
  if (pathname.includes('/ranks')) {
    return 'ranks';
  }
  if (pathname.includes('/specializations')) {
    return 'specializations';
  }
  if (pathname.includes('/registrations')) {
    return 'registrations';
  }
  if (pathname.includes('/discoveryTypes')) {
    return 'discoveryTypes';
  }
  if (pathname.includes('/medals')) {
    return 'medals';
  }
  if (pathname.includes('/positions')) {
    return 'positions';
  }
  if (pathname.includes('/roles')) {
    return 'roles';
  }
  if (pathname.includes('/logs')) {
    return 'logs';
  }
  if (pathname.includes('/settings')) {
    return 'settings';
  }
  if (pathname.includes('/backup')) {
    return 'backup';
  }
  if (pathname.includes('/questionnaires')) {
    return 'questionnaires';
  }
  if (pathname.includes('/myQuestionnaires')) {
    return 'myQuestionnaires';
  }
  return 'dashboard';
}

export default function Navigation() {
  const breakpoints = Grid.useBreakpoint();
  const user = useTracker(() => Meteor.user(), []);
  const { t } = useTranslation();

  const { navigationValue, setNavigationValue } = useNavigation();
  const { actionItems, handleAction, profileModal } = useUserMenu();
  const isMobile = !breakpoints.md;
  useEffect(() => {
    window.addEventListener('popstate', () => {
      if (navigationValue !== getNavigationValue()) {
        setNavigationValue(getNavigationValue());
      }
    });
    return () => {
      window.removeEventListener('popstate', () => {});
    };
  }, [navigationValue, setNavigationValue]);

  const handleNavigationClick = useCallback(
    ({ key }: { key: string }) => {
      if (USER_ACTION_KEYS.has(key)) {
        handleAction(key);
        return;
      }
      setNavigationValue(key);
      window.history.pushState(null, '', `${window.location.origin}/${key}`);
    },
    [setNavigationValue, handleAction]
  );

  useSubscribe('roles', { _id: (user?.profile?.roleId ?? null) as unknown as string }, { limit: 1 });
  const roles = useFind(
    () => RolesCollection.find({ _id: (user?.profile?.roleId ?? null) as unknown as string }, { limit: 1 }),
    [user?.profile?.roleId]
  );
  const items = useMemo(() => {
    const role = roles?.[0];
    const newItems: NonNullable<MenuProps['items']> = [];
    if (!role) {
      return [];
    }
    if (hasAccess(role, 'dashboard')) {
      newItems.push({ key: 'dashboard', label: t('navigation.dashboard'), icon: <DashboardOutlined /> });
    }
    if (hasAccess(role, 'orbat')) {
      newItems.push({
        key: 'orbat',
        label: t('navigation.orbat'),
        icon: <ClusterOutlined />,
      });
    }
    if (hasAccess(role, 'dashboard') || hasAccess(role, 'orbat')) {
      newItems.push({
        key: 'div-0',
        type: 'divider',
      });
    }
    if (hasAccess(role, 'events')) {
      newItems.push({
        key: 'events',
        label: t('navigation.events'),
        icon: <CalendarOutlined />,
      });
    }
    if (hasAccess(role, 'eventTypes')) {
      newItems.push({
        key: 'eventTypes',
        label: t('navigation.eventTypes'),
        icon: <TagsOutlined />,
      });
    }
    if (hasAccess(role, 'briefingTemplates')) {
      newItems.push({
        key: 'briefingTemplates',
        label: t('navigation.briefingTemplates'),
        icon: <SnippetsOutlined />,
      });
    }
    if (hasAccess(role, 'events') || hasAccess(role, 'eventTypes') || hasAccess(role, 'briefingTemplates')) {
      newItems.push({
        key: 'div-1',
        type: 'divider',
      });
    }
    if (hasAccess(role, 'tasks')) {
      newItems.push({
        key: 'tasks',
        label: t('navigation.tasks'),
        icon: <CheckCircleOutlined />,
      });
    }
    if (hasAccess(role, 'taskStatus')) {
      newItems.push({
        key: 'taskStatus',
        label: t('navigation.taskStatus'),
        icon: <OrderedListOutlined />,
      });
    }
    if (hasAccess(role, 'tasks') || hasAccess(role, 'taskStatus')) {
      newItems.push({
        key: 'div-2',
        type: 'divider',
      });
    }
    if (hasAccess(role, 'squads')) {
      newItems.push({
        key: 'squads',
        label: t('navigation.squads'),
        icon: <TeamOutlined />,
      });
    }
    if (hasAccess(role, 'members')) {
      newItems.push({
        key: 'members',
        label: t('navigation.members'),
        icon: <UserOutlined />,
      });
    }
    if (hasAccess(role, 'ranks')) {
      newItems.push({
        key: 'ranks',
        label: t('navigation.ranks'),
        icon: <IdcardOutlined />,
      });
    }
    if (hasAccess(role, 'specializations')) {
      newItems.push({
        key: 'specializations',
        label: t('navigation.specializations'),
        icon: <SolutionOutlined />,
      });
    }
    if (hasAccess(role, 'medals')) {
      newItems.push({
        key: 'medals',
        label: t('navigation.medals'),
        icon: <TrophyOutlined />,
      });
    }
    if (hasAccess(role, 'positions')) {
      newItems.push({
        key: 'positions',
        label: t('navigation.positions'),
        icon: <AimOutlined />,
      });
    }
    if (hasAccess(role, 'squads') || hasAccess(role, 'members') || hasAccess(role, 'ranks') || hasAccess(role, 'specializations')) {
      newItems.push({
        key: 'div-3',
        type: 'divider',
      });
    }
    if (hasAccess(role, 'registrations')) {
      newItems.push({
        key: 'registrations',
        label: t('navigation.registrations'),
        icon: <UserAddOutlined />,
      });
    }
    if (hasAccess(role, 'discoveryTypes')) {
      newItems.push({
        key: 'discoveryTypes',
        label: t('navigation.discoveryTypes'),
        icon: <TagOutlined />,
      });
    }
    if (hasAccess(role, 'registrations') || hasAccess(role, 'discoveryTypes')) {
      newItems.push({
        key: 'div-4',
        type: 'divider',
      });
    }
    if (hasAccess(role, 'questionnaires')) {
      newItems.push({
        key: 'myQuestionnaires',
        label: 'My Questionnaires',
        icon: <FormOutlined />,
      });
      newItems.push({
        key: 'questionnaires',
        label: 'Manage Questionnaires',
        icon: <FormOutlined />,
      });
    }
    if (hasAccess(role, 'questionnaires') || hasAccess(role, 'roles') || hasAccess(role, 'logs') || hasAccess(role, 'settings')) {
      newItems.push({
        key: 'div-5',
        type: 'divider',
      });
    }
    if (hasAccess(role, 'roles')) {
      newItems.push({
        key: 'roles',
        label: t('navigation.roles'),
        icon: <UsergroupAddOutlined />,
      });
    }
    if (hasAccess(role, 'logs')) {
      newItems.push({
        key: 'logs',
        label: t('navigation.logs'),
        icon: <FileTextOutlined />,
      });
    }
    if (hasAccess(role, 'settings')) {
      newItems.push({
        key: 'settings',
        label: t('navigation.settings'),
        icon: <SettingOutlined />,
      });
    }
    if (hasAccess(role, 'settings')) {
      newItems.push({
        key: 'backup',
        label: t('navigation.backup'),
        icon: <CloudServerOutlined />,
      });
    }

    // On mobile the bottom footer (user identity + actions) is hidden, so its
    // controls live here instead — under a header showing who is signed in.
    if (isMobile && user) {
      newItems.push({ key: 'div-user', type: 'divider' });
      newItems.push({
        key: 'user-header',
        type: 'group',
        label: user.profile?.name || user.username,
      });
      newItems.push(...actionItems);
    }

    return newItems;
  }, [roles, navigationValue, t, isMobile, user, actionItems]);

  const shortcutLabel = useMemo(() => getPaletteShortcutLabel(), []);

  return (
    <nav>
      {user && (
        <Dropdown
          trigger={['click']}
          menu={{
            selectedKeys: [navigationValue],
            items,
            onClick: handleNavigationClick,
            // Cap to the viewport and scroll: the menu can be tall on mobile
            // (all nav entries + the user section that replaces the footer).
            style: { maxHeight: 'calc(100dvh - 72px)', overflowY: 'auto' },
          }}
        >
          <Tooltip title={t('palette.shortcutHint', { shortcut: shortcutLabel })} placement="bottomRight">
            <Button size="large" icon={<MenuOutlined />}>
              {breakpoints.sm && t('navigation.title')}
            </Button>
          </Tooltip>
        </Dropdown>
      )}
      {isMobile && profileModal}
    </nav>
  );
}
