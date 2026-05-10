import { App as AntdApp, theme as AntdTheme, ConfigProvider, Drawer, Layout } from 'antd';
import { Meteor } from 'meteor/meteor';
import React, { createContext, ReactNode, useCallback, useEffect, useState } from 'react';
import { getDrawerWidth } from '../../config';
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
import type { DrawerContextValue } from './types';

export const NavigationContext = createContext<NavigationContextValue>({} as NavigationContextValue);
export const ThemeContext = createContext<ThemeContextValue>({} as ThemeContextValue);
export const DrawerContext = createContext<DrawerContextValue>({} as DrawerContextValue);
export const SubdrawerContext = createContext<DrawerContextValue>({} as DrawerContextValue);

const empty: ReactNode = <></>;

interface AppSettings {
  communityColor?: string;
}

export default function App() {
  const { message, notification } = AntdApp.useApp();
  const { communityColor } = useSettings() as unknown as AppSettings;
  const [theme, setTheme] = useState<ThemeMode>(getPreferedTheme());
  const [navigationValue, setNavigationValue] = useState<string>(getNavigationValue());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerComponent, setDrawerComponent] = useState<ReactNode>(empty);
  const [drawerExtra, setDrawerExtra] = useState<ReactNode>(empty);
  const [drawerTitle, setDrawerTitle] = useState('');
  const [drawerModel, setDrawerModel] = useState<Record<string, unknown>>({});
  const [subdrawerOpen, setSubdrawerOpen] = useState(false);
  const [subdrawerComponent, setSubdrawerComponent] = useState<ReactNode>(empty);
  const [subdrawerExtra, setSubdrawerExtra] = useState<ReactNode>(empty);
  const [subdrawerTitle, setSubdrawerTitle] = useState('');
  const [subdrawerModel, setSubdrawerModel] = useState<Record<string, unknown>>({});

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
        <DrawerContext.Provider
          value={{
            drawerOpen,
            setDrawerOpen,
            drawerComponent,
            setDrawerComponent,
            drawerModel,
            setDrawerModel,
            drawerTitle,
            setDrawerTitle,
            drawerExtra,
            setDrawerExtra,
          }}
        >
          <SubdrawerContext.Provider
            value={{
              drawerOpen: subdrawerOpen,
              setDrawerOpen: setSubdrawerOpen,
              drawerComponent: subdrawerComponent,
              setDrawerComponent: setSubdrawerComponent,
              drawerModel: subdrawerModel,
              setDrawerModel: setSubdrawerModel,
              drawerTitle: subdrawerTitle,
              setDrawerTitle: setSubdrawerTitle,
              drawerExtra: subdrawerExtra,
              setDrawerExtra: setSubdrawerExtra,
            }}
          >
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
                    <Drawer
                      width={getDrawerWidth(window.innerWidth)}
                      open={drawerOpen}
                      onClose={() => setDrawerOpen(false)}
                      title={drawerTitle}
                      extra={drawerExtra}
                      destroyOnHidden
                    >
                      {drawerComponent}
                      <Drawer
                        width={getDrawerWidth(window.innerWidth)}
                        open={subdrawerOpen}
                        onClose={() => setSubdrawerOpen(false)}
                        title={subdrawerTitle}
                        extra={subdrawerExtra}
                        destroyOnHidden
                      >
                        {subdrawerComponent}
                      </Drawer>
                    </Drawer>
                  </AntdApp>
                </ConfigProvider>
              </PaletteProvider>
            </TourProvider>
          </SubdrawerContext.Provider>
        </DrawerContext.Provider>
      </NavigationContext.Provider>
    </ThemeContext.Provider>
  );
}
