import { apiClient } from "../api";
import type {
  ApiOk,
  ApiPaginated,
  UserDTO,
  DesignationDTO,
  PermissionTemplateDTO,
  TeamDTO,
  TeamDetailDTO,
  UserPermissions,
  UserRole,
} from "../../types/api";

export interface CreateUserPayload {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  role: UserRole;
  designationId?: string | null;
  managerId?: string | null;
  permissions?: UserPermissions;
}

export interface UpdateUserPayload {
  firstName?: string;
  lastName?: string;
  role?: UserRole;
  designationId?: string | null;
  managerId?: string | null;
  permissions?: UserPermissions;
  isActive?: boolean;
}

export interface UserListParams {
  page?: number;
  limit?: number;
  role?: UserRole;
  isActive?: boolean;
  search?: string;
  managerId?: string;
}

export const usersApi = {
  list: (params?: UserListParams) =>
    apiClient
      .get<ApiPaginated<UserDTO>>("/users", { params })
      .then((r) => r.data),

  get: (id: string) =>
    apiClient.get<ApiOk<UserDTO>>(`/users/${id}`).then((r) => r.data.data),

  create: (data: CreateUserPayload) =>
    apiClient.post<ApiOk<UserDTO>>("/users", data).then((r) => r.data.data),

  update: (id: string, data: UpdateUserPayload) =>
    apiClient.patch<ApiOk<UserDTO>>(`/users/${id}`, data).then((r) => r.data.data),

  resetPassword: (id: string, newPassword: string) =>
    apiClient.post(`/users/${id}/reset-password`, { newPassword }),

  // Designations
  listDesignations: () =>
    apiClient.get<ApiOk<DesignationDTO[]>>("/designations").then((r) => r.data.data),

  createDesignation: (name: string) =>
    apiClient.post<ApiOk<DesignationDTO>>("/designations", { name }).then((r) => r.data.data),

  deleteDesignation: (id: string) =>
    apiClient.delete(`/designations/${id}`),

  // Permission templates
  listPermissionTemplates: () =>
    apiClient
      .get<ApiOk<PermissionTemplateDTO[]>>("/permission-templates")
      .then((r) => r.data.data),

  createPermissionTemplate: (data: { name: string; permissions: UserPermissions }) =>
    apiClient
      .post<ApiOk<PermissionTemplateDTO>>("/permission-templates", data)
      .then((r) => r.data.data),

  updatePermissionTemplate: (
    id: string,
    data: { name?: string; permissions?: UserPermissions }
  ) =>
    apiClient
      .patch<ApiOk<PermissionTemplateDTO>>(`/permission-templates/${id}`, data)
      .then((r) => r.data.data),

  deletePermissionTemplate: (id: string) =>
    apiClient.delete(`/permission-templates/${id}`),

  applyPermissionTemplate: (id: string, userIds: string[]) =>
    apiClient.post(`/permission-templates/${id}/apply`, { userIds }),

  // Teams
  listTeams: () =>
    apiClient.get<ApiOk<TeamDTO[]>>("/teams").then((r) => r.data.data),

  getTeam: (id: string) =>
    apiClient.get<ApiOk<TeamDetailDTO>>(`/teams/${id}`).then((r) => r.data.data),

  createTeam: (data: { name: string; managerId?: string | null; memberIds?: string[] }) =>
    apiClient.post<ApiOk<TeamDTO>>("/teams", data).then((r) => r.data.data),

  updateTeam: (id: string, data: { name?: string; managerId?: string | null }) =>
    apiClient.patch<ApiOk<TeamDTO>>(`/teams/${id}`, data).then((r) => r.data.data),

  deleteTeam: (id: string) =>
    apiClient.delete(`/teams/${id}`),

  addTeamMembers: (teamId: string, userIds: string[]) =>
    apiClient.post(`/teams/${teamId}/members`, { userIds }),

  removeTeamMember: (teamId: string, userId: string) =>
    apiClient.delete(`/teams/${teamId}/members/${userId}`),
};
