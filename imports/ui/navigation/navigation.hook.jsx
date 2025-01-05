import React, { useContext } from 'react';
import { NavigationContext } from '../app/App';

export default function useNavigation() {
  const value = useContext(NavigationContext);

  return {
    navigationValue: value.navigationValue,
    setNavigationValue: value.setNavigationValue,
  };
}
