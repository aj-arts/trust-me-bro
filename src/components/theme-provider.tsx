"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type DeckTheme = "dark" | "light";

type ThemeContextValue = {
  theme: DeckTheme;
  setTheme: (theme: DeckTheme) => void;
  toggleTheme: () => void;
};

const STORAGE_KEY = "tmb-deck-theme";
const ThemeContext = createContext<ThemeContextValue | null>(null);

function getStoredTheme(): DeckTheme {
  if (typeof window === "undefined") {
    return "dark";
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "light" || stored === "dark" ? stored : "dark";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<DeckTheme>(getStoredTheme);

  useEffect(() => {
    document.documentElement.dataset.deckTheme = theme;
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme: setThemeState,
      toggleTheme: () => setThemeState((current) => (current === "dark" ? "light" : "dark")),
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useDeckTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useDeckTheme must be used within ThemeProvider");
  }

  return context;
}
