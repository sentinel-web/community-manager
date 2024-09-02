import React from "react";
import useNavigation from "../navigation/navigation.hook";
import Suspense from "../suspense/Suspense";
import Login from "../login/Login";
import { Meteor } from "meteor/meteor";
import { useTracker } from "meteor/react-meteor-data";

const Dashboard = React.lazy(() => import("../dashboard/Dashboard"));
const Members = React.lazy(() => import("../members/Members"));
const Events = React.lazy(() => import("../events/Events"));
const Tasks = React.lazy(() => import("../tasks/Tasks"));
const Settings = React.lazy(() => import("../settings/Settings"));

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
          {navigationValue === "dashboard" && <Dashboard />}
          {navigationValue === "members" && <Members />}
          {navigationValue === "events" && <Events />}
          {navigationValue === "tasks" && <Tasks />}
          {navigationValue === "settings" && <Settings />}
        </Suspense>
      )}
    </section>
  );
}
