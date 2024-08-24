import React from "react";
import { NavigationContext } from "../app/App";

export default function useNavigation() {
  const value = React.useContext(NavigationContext);

  return {
    navigationValue: value.navigationValue,
    setNavigationValue: value.setNavigationValue,
  };
}
