import React, { createContext, useEffect, useState } from "react";
import Header from "../header/Header";
import Main from "../main/Main";
import { getNavigationValue } from "../navigation/Navigation";
import { getPreferedTheme } from "../theme/theme.hook";
import { App as AntdApp, ConfigProvider, theme as AntdTheme } from "antd";

export const NavigationContext = createContext({});
export const ThemeContext = createContext({});

export default function App() {
  const [theme, setTheme] = useState(getPreferedTheme());
  const [navigationValue, setNavigationValue] = useState(getNavigationValue());
  useEffect(function () {
    document.body.classList.add(theme);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <NavigationContext.Provider
        value={{ navigationValue, setNavigationValue }}
      >
        <AntdApp className="app">
          <ConfigProvider
            theme={{
              token: {
                borderRadius: 8,
                fontSize: 16,
                colorBgBase: theme === "dark" ? "#282828" : "#f8f8f2",
                colorTextBase: theme === "dark" ? "#f8f8f2" : "#282828",
              },
              algorithm:
                theme === "dark"
                  ? AntdTheme.darkAlgorithm
                  : AntdTheme.defaultAlgorithm,
            }}
          >
            <Header />
            <Main />
          </ConfigProvider>
        </AntdApp>
      </NavigationContext.Provider>
    </ThemeContext.Provider>
  );
}
