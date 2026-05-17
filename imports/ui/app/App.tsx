import { App as AntdApp, theme as AntdTheme, ConfigProvider, Layout } from 'antd';
import { Meteor } from 'meteor/meteor';
import React, { createContext, useCallback, useEffect, useState } from 'react';
import Footer from '../footer/Footer';
import Header from '../header/Header';
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

interface AppSettings {
  communityColor?: string;
}

export default function App() {
  const { message, notification } = AntdApp.useApp();
  const { communityColor } = useSettings() as unknown as AppSettings;
  const [theme, setTheme] = useState<ThemeMode>(getPreferedTheme);
  const [navigationValue, setNavigationValue] = useState<string>(getNavigationValue);

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
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <NavigationContext.Provider value={{ navigationValue, setNavigationValue }}>
        <TourProvider>
          <PaletteProvider>
            <ConfigProvider
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
              <AntdApp className="app" message={{ ...message, maxCount: 1 }} notification={{ ...notification, maxCount: 3 }}>
                <DrawerStackProvider>
                  <Layout>
                    <Layout.Header>
                      <Header />
                    </Layout.Header>
                    <Layout.Content style={{ flex: 1, overflow: 'auto' }}>
                      <Main />
                    </Layout.Content>
                    <Layout.Footer>
                      <Footer />
                    </Layout.Footer>
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
  );
}
