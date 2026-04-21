import { useContext } from 'react';
import { NavigationContext } from '../app/App';

export interface NavigationContextValue {
  navigationValue: string;
  setNavigationValue: (value: string) => void;
}

export default function useNavigation(): NavigationContextValue {
  const value = useContext(NavigationContext) as NavigationContextValue;

  return {
    navigationValue: value.navigationValue,
    setNavigationValue: value.setNavigationValue,
  };
}
