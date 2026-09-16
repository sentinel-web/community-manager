import { Result } from 'antd';
import { Meteor } from 'meteor/meteor';
import { useTracker } from 'meteor/react-meteor-data';
import React, { lazy, useMemo } from 'react';
import type { Role, CrudPermission } from '../../api/types';
import { isDeviceUnsupported } from '../../config';
import useOwnRole from '../hooks/useOwnRole';
import useViewportSize from '../hooks/useViewportSize';
import Login from '../login/Login';
import useNavigation from '../navigation/navigation.hook';
import Suspense, { SuspenseFallback } from '../suspense/Suspense';

const MODULE_PERMISSION_MAP: Record<string, keyof Role> = {
  backup: 'settings',
  myQuestionnaires: 'questionnaires',
};

function checkAccess(role: Role | undefined, module: string): boolean {
  if (!role) return false;

  if (role.roles === true) return true;

  const permissionKey = (MODULE_PERMISSION_MAP[module] ?? module) as keyof Role;
  const permission = role[permissionKey];

  if (permission === true) return true;
  if (permission === false || permission === undefined) return false;

  if (typeof permission === 'object' && permission !== null) {
    return (permission as CrudPermission).read === true;
  }

  return false;
}

const Dashboard = lazy(() => import('../dashboard/Dashboard'));
const Orbat = lazy(() => import('../orbat/Orbat'));
const Members = lazy(() => import('../members/Members'));
const Events = lazy(() => import('../events/Events'));
const EventTypes = lazy(() => import('../events/event-types/EventTypes'));
const BriefingTemplates = lazy(() => import('../briefing-templates/BriefingTemplates'));
const Tasks = lazy(() => import('../tasks/Tasks'));
const TaskStatuses = lazy(() => import('../tasks/task-status/TaskStatuses'));
const Specializations = lazy(() => import('../specializations/Specializations'));
const Medals = lazy(() => import('../members/medals/Medals'));
const Positions = lazy(() => import('../members/positions/Positions'));
const Ranks = lazy(() => import('../members/ranks/Ranks'));
const Squads = lazy(() => import('../squads/Squads'));
const Registrations = lazy(() => import('../registration/Registration'));
const DiscoveryTypes = lazy(() => import('../registration/discovery-types/DiscoveryTypes'));
const Roles = lazy(() => import('../members/roles/Roles'));
const Logs = lazy(() => import('../logs/Logs'));
const Settings = lazy(() => import('../settings/Settings'));
const Backup = lazy(() => import('../backup/Backup'));
const Questionnaires = lazy(() => import('../questionnaires/Questionnaires'));
const MyQuestionnaires = lazy(() => import('../questionnaires/MyQuestionnaires'));

export default function Main() {
  const { navigationValue } = useNavigation();
  const { width } = useViewportSize();
  const loggedIn = useTracker(() => !!Meteor.userId(), []);

  const { role, loading: roleLoading } = useOwnRole();
  const hasAccess = useMemo(() => checkAccess(role, navigationValue), [role, navigationValue]);

  if (isDeviceUnsupported(width)) {
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
          {/* The role decides every branch below, so it must be known first:
              showing the 403 panel while it is still in flight made a normal
              page load flash "Access Denied" (#355). */}
          {roleLoading && <SuspenseFallback />}
          {!roleLoading && !hasAccess && (
            <Result status="403" title="401 - Access Denied" subTitle="Sorry, you are not authorized to access this page." />
          )}
          {hasAccess && navigationValue === 'dashboard' && <Dashboard />}
          {hasAccess && navigationValue === 'orbat' && <Orbat />}
          {hasAccess && navigationValue === 'events' && <Events />}
          {hasAccess && navigationValue === 'eventTypes' && <EventTypes />}
          {hasAccess && navigationValue === 'briefingTemplates' && <BriefingTemplates />}
          {hasAccess && navigationValue === 'tasks' && <Tasks />}
          {hasAccess && navigationValue === 'taskStatus' && <TaskStatuses />}
          {hasAccess && navigationValue === 'squads' && <Squads />}
          {hasAccess && navigationValue === 'members' && <Members />}
          {hasAccess && navigationValue === 'ranks' && <Ranks />}
          {hasAccess && navigationValue === 'specializations' && <Specializations />}
          {hasAccess && navigationValue === 'medals' && <Medals />}
          {hasAccess && navigationValue === 'positions' && <Positions />}
          {hasAccess && navigationValue === 'registrations' && <Registrations />}
          {hasAccess && navigationValue === 'discoveryTypes' && <DiscoveryTypes />}
          {hasAccess && navigationValue === 'roles' && <Roles />}
          {hasAccess && navigationValue === 'logs' && <Logs />}
          {hasAccess && navigationValue === 'settings' && <Settings />}
          {hasAccess && navigationValue === 'backup' && <Backup />}
          {hasAccess && navigationValue === 'questionnaires' && <Questionnaires />}
          {hasAccess && navigationValue === 'myQuestionnaires' && <MyQuestionnaires />}
        </Suspense>
      )}
    </section>
  );
}
