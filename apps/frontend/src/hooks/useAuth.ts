"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { authApi } from "../lib/api/auth";
import { useAuthStore } from "../lib/auth-store";

export function useLogin() {
  const { setAuth } = useAuthStore();
  const router = useRouter();

  return useMutation({
    mutationFn: (data: { email: string; password: string }) => authApi.login(data),
    onSuccess: (result) => {
      setAuth(result.user, result.accessToken, result.refreshToken);
      router.replace("/dashboard");
    },
  });
}

export function useLogout() {
  const { refreshToken, clearAuth } = useAuthStore();
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async () => {
      if (refreshToken) await authApi.logout(refreshToken).catch(() => {});
    },
    onSettled: () => {
      clearAuth();
      queryClient.clear();
      router.replace("/login");
    },
  });
}

export function useMe() {
  const { isAuthenticated } = useAuthStore();
  return useQuery({
    queryKey: ["me"],
    queryFn: authApi.me,
    enabled: isAuthenticated(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: authApi.changePassword,
  });
}

export function useCurrentUser() {
  return useAuthStore((s) => s.user);
}

export function useHasPermission(key: keyof import("../types/api").UserPermissions) {
  const user = useAuthStore((s) => s.user);
  if (!user) return false;
  if (user.role === "super_admin" || user.role === "admin") return true;
  return Boolean(user.permissions?.[key]);
}
