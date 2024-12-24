import React, { useEffect } from 'react';
import useNavigation from './navigation.hook';
import { Button, Dropdown } from 'antd';
import {
  CalendarOutlined,
  CheckCircleOutlined,
  DashboardOutlined,
  MenuOutlined,
  SettingOutlined,
  SolutionOutlined,
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

  const handleNavigationClick = React.useCallback(
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
                key: 'members',
                label: 'Members',
                icon: <UserOutlined />,
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
                key: 'specializations',
                label: 'Specializations',
                icon: <SolutionOutlined />,
              },
              {
                key: 'registrations',
                label: 'Registrations',
                icon: <UserAddOutlined />,
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
