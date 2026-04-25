import { useState, useEffect, createContext, useContext } from "react";

type ThemeName = "calm" | "aesthetic" | "focus";

interface ThemeContextType {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  isDark: boolean;
  setIsDark: (isDark: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeName>(() => {
    const saved = localStorage.getItem("ff_theme");
    return (saved as ThemeName) || "calm";
  });

  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem("ff_isDark");
    return saved ? saved === "true" : false;
  });

  useEffect(() => {
    localStorage.setItem("ff_theme", theme);
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("ff_isDark", isDark.toString());
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDark]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isDark, setIsDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
