import { App as AntdApp, theme as AntdTheme, ConfigProvider, Grid, Layout } from 'antd';
import type { ConfigProviderProps } from 'antd';
import deDE from 'antd/locale/de_DE';
import enUS from 'antd/locale/en_US';
import frFR from 'antd/locale/fr_FR';
import dayjs from 'dayjs';
import 'dayjs/locale/de';
import 'dayjs/locale/fr';
import { Meteor } from 'meteor/meteor';
import React, { createContext, useCallback, useEffect, useState } from 'react';
import type { Locale } from '../../i18n';
import { useLanguage } from '../../i18n/LanguageContext';
import Footer from '../footer/Footer';
import Header from '../header/Header';
import OwnRoleProvider from '../hooks/OwnRoleProvider';
import Main from '../main/Main';
import { getNavigationValue } from '../navigation/Navigation';
import type { NavigationContextValue } from '../navigation/navigation.hook';
import useSettings from '../settings/settings.hook';
import { getPreferedTheme } from '../theme/theme.hook';
import type { ThemeContextValue, ThemeMode } from '../theme/theme.hook';
import Palette from '../palette/Palette';
import { PaletteProvider } from '../palette/PaletteContext';
import DemoTour from '../tour/DemoTour';
import { TourProvider } from '../tour/TourContext';
import { DrawerStackProvider } from '../drawer-stack';

export const NavigationContext = createContext<NavigationContextValue>({} as NavigationContextValue);
export const ThemeContext = createContext<ThemeContextValue>({} as ThemeContextValue);

// antd's built-in texts (pagination, pickers, Popconfirm/Modal buttons, form
// validation messages, …) follow the app language.
const ANTD_LOCALES: Record<Locale, ConfigProviderProps['locale']> = {
  de: deDE,
  en: enUS,
  fr: frFR,
};

interface AppSettings {
  communityColor?: string;
}

export default function App() {
  const { communityColor } = useSettings() as unknown as AppSettings;
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const [theme, setTheme] = useState<ThemeMode>(getPreferedTheme);
  const [navigationValue, setNavigationValue] = useState<string>(getNavigationValue);
  const { language } = useLanguage();

  // antd date pickers and the calendar format through the global dayjs locale.
  // Set during render, not in an effect: an effect runs after the first paint,
  // which would show English dates for a frame after every reload.
  if (dayjs.locale() !== language) dayjs.locale(language);

  useEffect(() => {
    if (!communityColor) return;
    document.documentElement.style.setProperty('--primary-color', communityColor);
  }, [communityColor]);

  const handleSystemThemeChange = useCallback((e: MediaQueryListEvent) => {
    setTheme(e.matches ? 'dark' : 'light');
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', handleSystemThemeChange);
    return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
  }, [handleSystemThemeChange]);

  useEffect(() => {
    document.body.classList.remove('light', 'dark');
    document.body.classList.add(theme);
  }, [theme]);

  return (
    // One `roles.own` subscription for the whole app — every permission-gated
    // component reads it through useOwnRole instead of subscribing itself.
    <OwnRoleProvider>
      <ThemeContext.Provider value={{ theme, setTheme }}>
        <NavigationContext.Provider value={{ navigationValue, setNavigationValue }}>
          <TourProvider>
            <PaletteProvider>
              <ConfigProvider
                locale={ANTD_LOCALES[language]}
                theme={{
                  token: {
                    colorPrimary: communityColor,
                    borderRadius: 8,
                    fontSize: 16,
                    colorBgBase: theme === 'dark' ? '#282828' : '#f8f8f2',
                    colorTextBase: theme === 'dark' ? '#f8f8f2' : '#282828',
                  },
                  algorithm: theme === 'dark' ? AntdTheme.darkAlgorithm : AntdTheme.defaultAlgorithm,
                }}
              >
                <AntdApp className="app" message={{ maxCount: 1 }} notification={{ maxCount: 3 }}>
                  <DrawerStackProvider>
                    <Layout>
                      <Layout.Header>
                        <Header />
                      </Layout.Header>
                      <Layout.Content style={{ flex: 1, overflow: 'auto' }}>
                        <Main />
                      </Layout.Content>
                      {!isMobile && (
                        <Layout.Footer>
                          <Footer />
                        </Layout.Footer>
                      )}
                    </Layout>
                    {Meteor.isDevelopment && <DemoTour />}
                    <Palette />
                  </DrawerStackProvider>
                </AntdApp>
              </ConfigProvider>
            </PaletteProvider>
          </TourProvider>
        </NavigationContext.Provider>
      </ThemeContext.Provider>
    </OwnRoleProvider>
  );
}
