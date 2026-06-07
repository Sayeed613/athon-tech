"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware"

type Theme = "light" | "dark" | "system";

interface ThemeState {
  theme: Theme;
  effectiveTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
  _resolveSystem: () => "light" | "dark";
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: "light",
      effectiveTheme: "light",

      setTheme: (theme: Theme) => {
        const resolved = theme === "system" ? get()._resolveSystem() : theme;
        set({ theme, effectiveTheme: resolved });

        const root = document.documentElement;
        root.classList.remove("light", "dark");
        root.classList.add(resolved);
      },

      _resolveSystem: () => {
        if (typeof window === "undefined") return "light";
        return window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
      },
    }),
    {
      name: "athon-theme",
      partialize: (state) => ({ theme: state.theme }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const resolved =
          state.theme === "system" ? state._resolveSystem() : state.theme;
        state.effectiveTheme = resolved;
        document.documentElement.classList.add(resolved);
      },
    },
  ),
);
