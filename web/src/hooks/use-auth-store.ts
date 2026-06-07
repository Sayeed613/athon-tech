"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware"
import type { UserProfile, AuthState, SchoolContext } from "@/types/auth";
import { injectAuthStore } from "@/lib/axios";

interface AuthActions {
  setUser: (user: UserProfile) => void;
  setToken: (token: string) => void;
  setSchoolContext: (ctx: SchoolContext) => void;
  setLoading: (isLoading: boolean) => void;
  login: (token: string, user: UserProfile) => void;
  logout: () => void;
}

type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      // ── State ──────────────────────────────────────────────────
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: true,
      schoolContext: null,

      // ── Actions ────────────────────────────────────────────────
      setUser: (user) => set({ user }),
      setToken: (token) => set({ token }),
      setSchoolContext: (ctx) => set({ schoolContext: ctx }),
      setLoading: (isLoading) => set({ isLoading }),

      login: (token, user) =>
        set({
          token,
          user,
          isAuthenticated: true,
          isLoading: false,
        }),

      logout: () => {
        set({
          token: null,
          user: null,
          isAuthenticated: false,
          isLoading: false,
          schoolContext: null,
        });
      },
    }),
    {
      name: "athon-auth",
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        schoolContext: state.schoolContext,
      }),
    },
  ),
);

// Inject store into Axios for token access on requests
injectAuthStore(useAuthStore);
