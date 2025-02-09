import React, { lazy } from 'react';
import useNavigation from '../navigation/navigation.hook';
import Suspense from '../suspense/Suspense';
import Login from '../login/Login';
import { Meteor } from 'meteor/meteor';
import { useTracker } from 'meteor/react-meteor-data';

const Dashboard = lazy(() => import('../dashboard/Dashboard'));
const Orbat = lazy(() => import('../orbat/Orbat'));
const Members = lazy(() => import('../members/Members'));
const Events = lazy(() => import('../events/Events'));
const Tasks = lazy(() => import('../tasks/Tasks'));
const Specializations = lazy(() => import('../specializations/Specializations'));
const Squads = lazy(() => import('../squads/Squads'));
const Registrations = lazy(() => import('../registration/Registration'));
const Settings = lazy(() => import('../settings/Settings'));

export default function Main() {
  const { navigationValue } = useNavigation();
  const loggedIn = useTracker(() => {
    return !!Meteor.userId();
  }, []);

  return (
    <section className="container">
      {!loggedIn && <Login />}
      {loggedIn && (
        <Suspense>
          {navigationValue === 'dashboard' && <Dashboard />}
          {navigationValue === 'orbat' && <Orbat />}
          {navigationValue === 'members' && <Members />}
          {navigationValue === 'events' && <Events />}
          {navigationValue === 'tasks' && <Tasks />}
          {navigationValue === 'specializations' && <Specializations />}
          {navigationValue === 'squads' && <Squads />}
          {navigationValue === 'registrations' && <Registrations />}
          {navigationValue === 'settings' && <Settings />}
        </Suspense>
      )}
    </section>
  );
}
