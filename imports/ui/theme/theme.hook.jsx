import React from "react";
import { ThemeContext } from "../app/App";

export function getPreferedTheme() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export default function useTheme() {
  const value = React.useContext(ThemeContext);

  return { theme: value.theme, setTheme: value.setTheme };
}
