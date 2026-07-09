import { apiClient } from "../api";
import type { ApiOk, AuthUser } from "../../types/api";

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export const authApi = {
  login: (data: LoginPayload) =>
    apiClient.post<ApiOk<LoginResponse>>("/auth/login", data).then((r) => r.data.data),

  refresh: (refreshToken: string) =>
    apiClient
      .post<ApiOk<{ accessToken: string; refreshToken: string }>>("/auth/refresh", { refreshToken })
      .then((r) => r.data.data),

  logout: (refreshToken: string) =>
    apiClient.post("/auth/logout", { refreshToken }),

  logoutAll: () =>
    apiClient.post("/auth/logout-all"),

  me: () =>
    apiClient.get<ApiOk<AuthUser>>("/auth/me").then((r) => r.data.data),

  changePassword: (data: ChangePasswordPayload) =>
    apiClient.post<ApiOk<null>>("/auth/change-password", data).then((r) => r.data),
};
