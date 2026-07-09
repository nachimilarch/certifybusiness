"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UserPermissions } from "../types/api";

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "super_admin" | "admin" | "manager" | "employee";
  organisationId: string;
  permissions: UserPermissions;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  _hasHydrated: boolean;
  setAuth: (user: AuthUser, accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;
  isAuthenticated: () => boolean;
  setHasHydrated: (v: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      _hasHydrated: false,
      setAuth(user, accessToken, refreshToken) {
        set({ user, accessToken, refreshToken });
        if (typeof window !== "undefined") {
          localStorage.setItem("cb_access_token", accessToken);
          localStorage.setItem("cb_refresh_token", refreshToken);
        }
      },
      clearAuth() {
        set({ user: null, accessToken: null, refreshToken: null });
        if (typeof window !== "undefined") {
          localStorage.removeItem("cb_access_token");
          localStorage.removeItem("cb_refresh_token");
        }
      },
      isAuthenticated: () => !!get().accessToken && !!get().user,
      setHasHydrated: (v) => set({ _hasHydrated: v }),
    }),
    {
      name: "cb-auth",
      partialize: (s) => ({
        user: s.user,
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
      }),
      onRehydrateStorage: () => (state) => {
        // Sync individual localStorage keys so the API interceptor can read them
        // immediately after rehydration (before any React re-render).
        if (state && typeof window !== "undefined") {
          if (state.accessToken)
            localStorage.setItem("cb_access_token", state.accessToken);
          if (state.refreshToken)
            localStorage.setItem("cb_refresh_token", state.refreshToken);
        }
        state?.setHasHydrated(true);
      },
    }
  )
);
