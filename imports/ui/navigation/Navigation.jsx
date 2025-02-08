import React, { useCallback, useEffect } from 'react';
import useNavigation from './navigation.hook';
import { Button, Dropdown } from 'antd';
import {
  CalendarOutlined,
  CheckCircleOutlined,
  DashboardOutlined,
  MenuOutlined,
  SettingOutlined,
  SolutionOutlined,
  TeamOutlined,
  UserAddOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Meteor } from 'meteor/meteor';
import { useTracker } from 'meteor/react-meteor-data';

export function getNavigationValue() {
  const pathname = window.location.pathname;
  if (pathname === '/') {
    return 'dashboard';
  }
  if (pathname.includes('/dashboard')) {
    return 'dashboard';
  }
  if (pathname.includes('/members')) {
    return 'members';
  }
  if (pathname.includes('/events')) {
    return 'events';
  }
  if (pathname.includes('/tasks')) {
    return 'tasks';
  }
  if (pathname.includes('/specializations')) {
    return 'specializations';
  }
  if (pathname.includes('/squads')) {
    return 'squads';
  }
  if (pathname.includes('/settings')) {
    return 'settings';
  }
  if (pathname.includes('/registrations')) {
    return 'registrations';
  }
  return 'dashboard';
}

export default function Navigation() {
  const loggedIn = useTracker(() => {
    return !!Meteor.userId();
  }, []);
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

  return (
    <nav>
      {loggedIn && (
        <Dropdown
          trigger="click"
          menu={{
            selectedKeys: [navigationValue],
            items: [
              {
                key: 'dashboard',
                label: 'Dashboard',
                icon: <DashboardOutlined />,
              },
              {
                key: 'div-1',
                type: 'divider',
              },
              {
                key: 'members',
                label: 'Members',
                icon: <UserOutlined />,
              },
              {
                key: 'squads',
                label: 'Squads',
                icon: <TeamOutlined />,
              },
              {
                key: 'registrations',
                label: 'Registrations',
                icon: <UserAddOutlined />,
              },
              {
                key: 'specializations',
                label: 'Specializations',
                icon: <SolutionOutlined />,
              },
              {
                key: 'div-2',
                type: 'divider',
              },
              {
                key: 'events',
                label: 'Events',
                icon: <CalendarOutlined />,
              },
              {
                key: 'tasks',
                label: 'Tasks',
                icon: <CheckCircleOutlined />,
              },
              {
                key: 'div-3',
                type: 'divider',
              },
              {
                key: 'settings',
                label: 'Settings',
                icon: <SettingOutlined />,
              },
            ],
            onClick: handleNavigationClick,
          }}
        >
          <Button icon={<MenuOutlined />} />
        </Dropdown>
      )}
    </nav>
  );
}
