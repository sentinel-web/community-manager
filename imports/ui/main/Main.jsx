import { Result } from 'antd';
import { Meteor } from 'meteor/meteor';
import { useFind, useSubscribe, useTracker } from 'meteor/react-meteor-data';
import React, { lazy, useMemo } from 'react';
import RolesCollection from '../../api/collections/roles.collection';
import Login from '../login/Login';
import useNavigation from '../navigation/navigation.hook';
import Suspense from '../suspense/Suspense';

// Map modules to their permission keys (for modules that share permissions)
const MODULE_PERMISSION_MAP = {
  backup: 'settings', // Backup uses settings permission
};

/**
 * Checks if a role has access to a module.
 * Handles both boolean permissions (true/false) and CRUD object permissions.
 * For CRUD modules, access means having at least `read` permission.
 */
function checkAccess(role, module) {
  if (!role) return false;

  // Map module to its permission key
  const permissionKey = MODULE_PERMISSION_MAP[module] || module;
  const permission = role[permissionKey];

  // Boolean permission (true/false)
  if (permission === true) return true;
  if (permission === false || permission === undefined) return false;

  // CRUD object permission - check for read access
  if (typeof permission === 'object' && permission !== null) {
    return permission.read === true;
  }

  return false;
}

const Dashboard = lazy(() => import('../dashboard/Dashboard'));
const Orbat = lazy(() => import('../orbat/Orbat'));
const Members = lazy(() => import('../members/Members'));
const Events = lazy(() => import('../events/Events'));
const EventTypes = lazy(() => import('../events/event-types/EventTypes'));
const Tasks = lazy(() => import('../tasks/Tasks'));
const TaskStatuses = lazy(() => import('../tasks/task-status/TaskStatuses'));
const Specializations = lazy(() => import('../specializations/Specializations'));
const Medals = lazy(() => import('../members/medals/Medals'));
const Ranks = lazy(() => import('../members/ranks/Ranks'));
const Squads = lazy(() => import('../squads/Squads'));
const Registrations = lazy(() => import('../registration/Registration'));
const DiscoveryTypes = lazy(() => import('../registration/discovery-types/DiscoverTypes'));
const Roles = lazy(() => import('../members/roles/Roles'));
const Logs = lazy(() => import('../logs/Logs'));
const Settings = lazy(() => import('../settings/Settings'));
const Backup = lazy(() => import('../backup/Backup'));
const Questionnaires = lazy(() => import('../questionnaires/Questionnaires'));

export default function Main() {
  const { navigationValue } = useNavigation();
  const { loggedIn, user } = useTracker(() => {
    return {
      loggedIn: !!Meteor.userId(),
      user: Meteor.user(),
    };
  }, []);

  useSubscribe('roles', { _id: user?.profile?.roleId ?? null }, { limit: 1 });
  const roles = useFind(() => RolesCollection.find({ _id: user?.profile?.roleId ?? null }, { limit: 1 }), [user?.profile?.roleId]);
  const hasAccess = useMemo(() => {
    const role = roles?.[0];
    return checkAccess(role, navigationValue);
  }, [roles, navigationValue]);

  if (window.innerWidth < 360) {
    return (
      <section className="container">
        <Result status="500" title="406 - Not supported" subTitle="Sorry, this device is not supported." />
      </section>
    );
  }

  return (
    <section className="container">
      {!loggedIn && <Login />}
      {loggedIn && (
        <Suspense>
          {!hasAccess && <Result status="403" title="401 - Access Denied" subTitle="Sorry, you are not authorized to access this page." />}
          {hasAccess && navigationValue === 'dashboard' && <Dashboard />}
          {hasAccess && navigationValue === 'orbat' && <Orbat />}
          {hasAccess && navigationValue === 'events' && <Events />}
          {hasAccess && navigationValue === 'eventTypes' && <EventTypes />}
          {hasAccess && navigationValue === 'tasks' && <Tasks />}
          {hasAccess && navigationValue === 'taskStatus' && <TaskStatuses />}
          {hasAccess && navigationValue === 'squads' && <Squads />}
          {hasAccess && navigationValue === 'members' && <Members />}
          {hasAccess && navigationValue === 'ranks' && <Ranks />}
          {hasAccess && navigationValue === 'specializations' && <Specializations />}
          {hasAccess && navigationValue === 'medals' && <Medals />}
          {hasAccess && navigationValue === 'registrations' && <Registrations />}
          {hasAccess && navigationValue === 'discoveryTypes' && <DiscoveryTypes />}
          {hasAccess && navigationValue === 'roles' && <Roles />}
          {hasAccess && navigationValue === 'logs' && <Logs />}
          {hasAccess && navigationValue === 'settings' && <Settings />}
          {hasAccess && navigationValue === 'backup' && <Backup />}
          {hasAccess && navigationValue === 'questionnaires' && <Questionnaires />}
        </Suspense>
      )}
    </section>
  );
}
