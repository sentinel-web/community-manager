import { App as AntdApp, theme as AntdTheme, ConfigProvider, Drawer, Layout } from 'antd';
import { Meteor } from 'meteor/meteor';
import React, { createContext, useCallback, useEffect, useState } from 'react';
import { getDrawerWidth } from '../../config';
import Footer from '../footer/Footer';
import Header from '../header/Header';
import Main from '../main/Main';
import { getNavigationValue } from '../navigation/Navigation';
import useSettings from '../settings/settings.hook';
import { getPreferedTheme } from '../theme/theme.hook';
import DemoTour from '../tour/DemoTour';
import { TourProvider } from '../tour/TourContext';

export const NavigationContext = createContext({});
export const ThemeContext = createContext({});
export const DrawerContext = createContext({});
export const SubdrawerContext = createContext({});

const empty = <></>;

export default function App() {
  const { message, notification } = AntdApp.useApp();
  const { communityColor } = useSettings();
  const [theme, setTheme] = useState(getPreferedTheme());
  const [navigationValue, setNavigationValue] = useState(getNavigationValue());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerComponent, setDrawerComponent] = useState(empty);
  const [drawerExtra, setDrawerExtra] = useState(empty);
  const [drawerTitle, setDrawerTitle] = useState('');
  const [drawerModel, setDrawerModel] = useState({});
  const [subdrawerOpen, setSubdrawerOpen] = useState(false);
  const [subdrawerComponent, setSubdrawerComponent] = useState(empty);
  const [subdrawerExtra, setSubdrawerExtra] = useState(empty);
  const [subdrawerTitle, setSubdrawerTitle] = useState('');
  const [subdrawerModel, setSubdrawerModel] = useState({});

  useEffect(() => {
    if (!communityColor) return;
    document.documentElement.style.setProperty('--primary-color', communityColor);
  }, [communityColor]);

  const handleSystemThemeChange = useCallback(e => {
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
            </TourProvider>
          </SubdrawerContext.Provider>
        </DrawerContext.Provider>
      </NavigationContext.Provider>
    </ThemeContext.Provider>
  );
}
