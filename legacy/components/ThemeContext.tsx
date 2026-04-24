import React, { createContext, useContext, useMemo, useState } from "react";

type ThemeContextType = {
  backgroundColor: string;
  setBackgroundColor: (color: string) => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [backgroundColor, setBackgroundColor] = useState("#0f172a");

  const value = useMemo(
    () => ({
      backgroundColor,
      setBackgroundColor,
    }),
    [backgroundColor]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }

  return context;
}