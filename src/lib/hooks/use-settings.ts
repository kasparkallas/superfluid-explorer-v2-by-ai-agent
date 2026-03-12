import { useState, useEffect, useCallback, createContext, useContext } from "react";
import type { FlowRateGranularity } from "~/lib/utils/format";

export type Theme = "light" | "dark" | "system";
export type DecimalPlaces = "smart" | 5 | 9 | 18;

export interface Settings {
  theme: Theme;
  granularity: FlowRateGranularity;
  decimals: DecimalPlaces;
  showTestnets: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  granularity: "/mo",
  decimals: "smart",
  showTestnets: false,
};

const STORAGE_KEY = "sf-explorer-settings";

function loadSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(settings: Settings) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function useSettingsState() {
  const [settings, setSettingsRaw] = useState<Settings>(DEFAULT_SETTINGS);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setSettingsRaw(loadSettings());
    setMounted(true);
  }, []);

  const setSettings = useCallback((updater: Partial<Settings> | ((prev: Settings) => Settings)) => {
    setSettingsRaw((prev) => {
      const next = typeof updater === "function" ? updater(prev) : { ...prev, ...updater };
      saveSettings(next);
      return next;
    });
  }, []);

  // Apply theme
  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    root.classList.remove("light", "dark");

    if (settings.theme === "system") {
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.classList.add(isDark ? "dark" : "light");
    } else {
      root.classList.add(settings.theme);
    }
  }, [settings.theme, mounted]);

  return { settings, setSettings, mounted };
}

interface SettingsContextValue {
  settings: Settings;
  setSettings: (updater: Partial<Settings> | ((prev: Settings) => Settings)) => void;
}

export const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  setSettings: () => {},
});

export function useSettings() {
  return useContext(SettingsContext);
}
