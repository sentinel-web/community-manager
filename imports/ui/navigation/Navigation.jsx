import {
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
  SolutionOutlined,
  TagOutlined,
  TagsOutlined,
  TeamOutlined,
  TrophyOutlined,
  UserAddOutlined,
  UsergroupAddOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Button, Dropdown, Grid } from 'antd';
import { Meteor } from 'meteor/meteor';
import { useFind, useSubscribe, useTracker } from 'meteor/react-meteor-data';
import React, { useCallback, useEffect, useMemo } from 'react';
import RolesCollection from '../../api/collections/roles.collection';
import useNavigation from './navigation.hook';

/**
 * Checks if a role has access to a module.
 * Handles both boolean permissions (true/false) and CRUD object permissions.
 * For CRUD modules, access means having at least `read` permission.
 * @param {object} role - The role object containing permission definitions.
 * @param {string} module - The module name to check access for.
 * @returns {boolean} True if the role has access to the module.
 */
function hasAccess(role, module) {
  if (!role) return false;

  const permission = role[module];

  // Boolean permission (true/false)
  if (permission === true) return true;
  if (permission === false || permission === undefined) return false;

  // CRUD object permission - check for read access
  if (typeof permission === 'object' && permission !== null) {
    return permission.read === true;
  }

  return false;
}

/**
 * Determines the current navigation value based on the URL pathname.
 * Parses window.location.pathname to identify which section is active.
 * @returns {string} The navigation key corresponding to the current route (e.g., 'dashboard', 'events', 'members').
 */
export function getNavigationValue() {
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

/**
 * Navigation dropdown component.
 * Renders a dropdown menu with navigation items based on user permissions.
 * No props - uses Meteor reactive data and NavigationContext internally.
 */
export default function Navigation() {
  const breakpoints = Grid.useBreakpoint();
  const user = useTracker(() => Meteor.user(), []);

  const { navigationValue, setNavigationValue } = useNavigation();
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
    ({ key }) => {
      setNavigationValue(key);
      window.history.pushState(null, null, `${window.location.origin}/${key}`);
    },
    [setNavigationValue]
  );

  useSubscribe('roles', { _id: user?.profile?.roleId ?? null }, { limit: 1 });
  const roles = useFind(() => RolesCollection.find({ _id: user?.profile?.roleId ?? null }, { limit: 1 }), [user?.profile?.roleId]);
  const items = useMemo(() => {
    const role = roles?.[0];
    const newItems = [];
    if (!role) {
      return [];
    }
    if (hasAccess(role, 'dashboard')) {
      newItems.push({ key: 'dashboard', label: 'Dashboard', icon: <DashboardOutlined /> });
    }
    if (hasAccess(role, 'orbat')) {
      newItems.push({
        key: 'orbat',
        label: 'Orbat',
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
        label: 'Events',
        icon: <CalendarOutlined />,
      });
    }
    if (hasAccess(role, 'eventTypes')) {
      newItems.push({
        key: 'eventTypes',
        label: 'Event Types',
        icon: <TagsOutlined />,
      });
    }
    if (hasAccess(role, 'events') || hasAccess(role, 'eventTypes')) {
      newItems.push({
        key: 'div-1',
        type: 'divider',
      });
    }
    if (hasAccess(role, 'tasks')) {
      newItems.push({
        key: 'tasks',
        label: 'Tasks',
        icon: <CheckCircleOutlined />,
      });
    }
    if (hasAccess(role, 'taskStatus')) {
      newItems.push({
        key: 'taskStatus',
        label: 'Task Statuses',
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
        label: 'Squads',
        icon: <TeamOutlined />,
      });
    }
    if (hasAccess(role, 'members')) {
      newItems.push({
        key: 'members',
        label: 'Members',
        icon: <UserOutlined />,
      });
    }
    if (hasAccess(role, 'ranks')) {
      newItems.push({
        key: 'ranks',
        label: 'Ranks',
        icon: <IdcardOutlined />,
      });
    }
    if (hasAccess(role, 'specializations')) {
      newItems.push({
        key: 'specializations',
        label: 'Specializations',
        icon: <SolutionOutlined />,
      });
    }
    if (hasAccess(role, 'medals')) {
      newItems.push({
        key: 'medals',
        label: 'Medals',
        icon: <TrophyOutlined />,
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
        label: 'Registrations',
        icon: <UserAddOutlined />,
      });
    }
    if (hasAccess(role, 'discoveryTypes')) {
      newItems.push({
        key: 'discoveryTypes',
        label: 'Discovery Types',
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
        label: 'Roles',
        icon: <UsergroupAddOutlined />,
      });
    }
    if (hasAccess(role, 'logs')) {
      newItems.push({
        key: 'logs',
        label: 'Logs',
        icon: <FileTextOutlined />,
      });
    }
    if (hasAccess(role, 'settings')) {
      newItems.push({
        key: 'settings',
        label: 'Settings',
        icon: <SettingOutlined />,
      });
    }
    if (hasAccess(role, 'settings')) {
      newItems.push({
        key: 'backup',
        label: 'Backup',
        icon: <CloudServerOutlined />,
      });
    }

    return newItems;
  }, [roles, navigationValue]);

  return (
    <nav>
      {user && (
        <Dropdown
          trigger="click"
          menu={{
            selectedKeys: [navigationValue],
            items: items,
            onClick: handleNavigationClick,
          }}
        >
          <Button size="large" icon={<MenuOutlined />}>
            {breakpoints.sm && 'Navigation'}
          </Button>
        </Dropdown>
      )}
    </nav>
  );
}
