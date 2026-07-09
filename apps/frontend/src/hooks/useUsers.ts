"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usersApi, type UserListParams, type CreateUserPayload, type UpdateUserPayload } from "../lib/api/users";

export const userKeys = {
  all: ["users"] as const,
  list: (params?: UserListParams) => ["users", "list", params] as const,
  detail: (id: string) => ["users", "detail", id] as const,
  designations: () => ["designations"] as const,
  permissionTemplates: () => ["permission-templates"] as const,
  teams: () => ["teams"] as const,
  team: (id: string) => ["teams", id] as const,
};

export function useUsers(params?: UserListParams) {
  return useQuery({
    queryKey: userKeys.list(params),
    queryFn: () => usersApi.list(params),
  });
}

export function useUser(id: string) {
  return useQuery({
    queryKey: userKeys.detail(id),
    queryFn: () => usersApi.get(id),
    enabled: !!id,
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateUserPayload) => usersApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: userKeys.all }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserPayload }) =>
      usersApi.update(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: userKeys.all });
      qc.invalidateQueries({ queryKey: userKeys.detail(id) });
    },
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: ({ id, newPassword }: { id: string; newPassword: string }) =>
      usersApi.resetPassword(id, newPassword),
  });
}

// ─── Designations ─────────────────────────────────────────────────────────────

export function useDesignations() {
  return useQuery({
    queryKey: userKeys.designations(),
    queryFn: usersApi.listDesignations,
  });
}

export function useCreateDesignation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => usersApi.createDesignation(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: userKeys.designations() }),
  });
}

export function useDeleteDesignation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => usersApi.deleteDesignation(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: userKeys.designations() }),
  });
}

// ─── Permission Templates ────────────────────────────────────────────────────

export function usePermissionTemplates() {
  return useQuery({
    queryKey: userKeys.permissionTemplates(),
    queryFn: usersApi.listPermissionTemplates,
  });
}

export function useCreatePermissionTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: usersApi.createPermissionTemplate,
    onSuccess: () => qc.invalidateQueries({ queryKey: userKeys.permissionTemplates() }),
  });
}

export function useDeletePermissionTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => usersApi.deletePermissionTemplate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: userKeys.permissionTemplates() }),
  });
}

export function useApplyPermissionTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, userIds }: { id: string; userIds: string[] }) =>
      usersApi.applyPermissionTemplate(id, userIds),
    onSuccess: () => qc.invalidateQueries({ queryKey: userKeys.all }),
  });
}

// ─── Teams ───────────────────────────────────────────────────────────────────

export function useTeams() {
  return useQuery({
    queryKey: userKeys.teams(),
    queryFn: usersApi.listTeams,
  });
}

export function useTeam(id: string) {
  return useQuery({
    queryKey: userKeys.team(id),
    queryFn: () => usersApi.getTeam(id),
    enabled: !!id,
  });
}

export function useCreateTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: usersApi.createTeam,
    onSuccess: () => qc.invalidateQueries({ queryKey: userKeys.teams() }),
  });
}

export function useDeleteTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => usersApi.deleteTeam(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: userKeys.teams() }),
  });
}
