import { useEffect, useState } from "react";

type ThemeOption = "green" | "purple" | "blue";
type ModeOption = "light" | "dark";

export function useThemePreference() {
  const [colorTheme, setColorTheme] = useState<ThemeOption>("green");
  const [mode, setMode] = useState<ModeOption>("light");

  useEffect(() => {
    const storedTheme = localStorage.getItem("asho_theme");
    const storedMode = localStorage.getItem("asho_mode");
    if (storedTheme === "green" || storedTheme === "purple" || storedTheme === "blue") setColorTheme(storedTheme);
    if (storedMode === "light" || storedMode === "dark") setMode(storedMode);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = colorTheme;
    root.dataset.mode = mode;
    localStorage.setItem("asho_theme", colorTheme);
    localStorage.setItem("asho_mode", mode);
  }, [colorTheme, mode]);

  return { colorTheme, mode, setColorTheme, setMode };
}
