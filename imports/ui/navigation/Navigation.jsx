import React, { useEffect } from "react";
import useNavigation from "./navigation.hook";
import { Select } from "antd";

const listItems = [
  {
    value: "dashboard",
    label: "Dashboard",
  },
  {
    value: "members",
    label: "Members",
  },
  {
    value: "events",
    label: "Events",
  },
  {
    value: "tasks",
    label: "Tasks",
  },
  {
    value: "settings",
    label: "Settings",
  },
];

export function getNavigationValue() {
  const pathname = window.location.pathname;
  if (pathname === "/") {
    return "dashboard";
  } else if (pathname.includes("/dashboard")) {
    return "dashboard";
  } else if (pathname.includes("/members")) {
    return "members";
  } else if (pathname.includes("/events")) {
    return "events";
  } else if (pathname.includes("/tasks")) {
    return "tasks";
  } else if (pathname.includes("/settings")) {
    return "settings";
  }
  return "dashboard";
}

export default function Navigation() {
  const { navigationValue, setNavigationValue } = useNavigation();
  useEffect(function () {
    window.addEventListener("hashchange", function () {
      if (navigationValue !== getNavigationValue()) {
        setNavigationValue(getNavigationValue());
      }
    });
    return function () {
      window.removeEventListener("hashchange", function () {});
    };
  }, []);

  function handleChange(value) {
    setNavigationValue(value);
    window.location.replace(value);
  }

  return (
    <nav>
      <Select
        options={listItems}
        value={navigationValue}
        onChange={handleChange}
      />
    </nav>
  );
}
