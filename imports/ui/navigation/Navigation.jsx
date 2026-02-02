import {
  CalendarOutlined,
  CheckCircleOutlined,
  ClusterOutlined,
  DashboardOutlined,
  FileTextOutlined,
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
  return 'dashboard';
}

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
    if (role.dashboard === true) {
      newItems.push({ key: 'dashboard', label: 'Dashboard', icon: <DashboardOutlined /> });
    }
    if (role.orbat === true) {
      newItems.push({
        key: 'orbat',
        label: 'Orbat',
        icon: <ClusterOutlined />,
      });
    }
    if (role.dashboard || role.orbat) {
      newItems.push({
        key: 'div-0',
        type: 'divider',
      });
    }
    if (role.events === true) {
      newItems.push({
        key: 'events',
        label: 'Events',
        icon: <CalendarOutlined />,
      });
    }
    if (role.eventTypes === true) {
      newItems.push({
        key: 'eventTypes',
        label: 'Event Types',
        icon: <TagsOutlined />,
      });
    }
    if (role.events || role.eventTypes) {
      newItems.push({
        key: 'div-1',
        type: 'divider',
      });
    }
    if (role.tasks === true) {
      newItems.push({
        key: 'tasks',
        label: 'Tasks',
        icon: <CheckCircleOutlined />,
      });
    }
    if (role.taskStatus === true) {
      newItems.push({
        key: 'taskStatus',
        label: 'Task Statuses',
        icon: <OrderedListOutlined />,
      });
    }
    if (role.tasks || role.taskStatus) {
      newItems.push({
        key: 'div-2',
        type: 'divider',
      });
    }
    if (role.squads === true) {
      newItems.push({
        key: 'squads',
        label: 'Squads',
        icon: <TeamOutlined />,
      });
    }
    if (role.members === true) {
      newItems.push({
        key: 'members',
        label: 'Members',
        icon: <UserOutlined />,
      });
    }
    if (role.ranks === true) {
      newItems.push({
        key: 'ranks',
        label: 'Ranks',
        icon: <IdcardOutlined />,
      });
    }
    if (role.specializations === true) {
      newItems.push({
        key: 'specializations',
        label: 'Specializations',
        icon: <SolutionOutlined />,
      });
    }
    if (role.medals === true) {
      newItems.push({
        key: 'medals',
        label: 'Medals',
        icon: <TrophyOutlined />,
      });
    }
    if (role.squads || role.members || role.ranks || role.specializations) {
      newItems.push({
        key: 'div-3',
        type: 'divider',
      });
    }
    if (role.registrations === true) {
      newItems.push({
        key: 'registrations',
        label: 'Registrations',
        icon: <UserAddOutlined />,
      });
    }
    if (role.discoveryTypes === true) {
      newItems.push({
        key: 'discoveryTypes',
        label: 'Discovery Types',
        icon: <TagOutlined />,
      });
    }
    if (role.registrations || role.discoveryTypes) {
      newItems.push({
        key: 'div-4',
        type: 'divider',
      });
    }
    if (role.roles === true) {
      newItems.push({
        key: 'roles',
        label: 'Roles',
        icon: <UsergroupAddOutlined />,
      });
    }
    if (role.logs === true) {
      newItems.push({
        key: 'logs',
        label: 'Logs',
        icon: <FileTextOutlined />,
      });
    }
    if (role.settings === true) {
      newItems.push({
        key: 'settings',
        label: 'Settings',
        icon: <SettingOutlined />,
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
