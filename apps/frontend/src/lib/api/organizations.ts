import { apiClient } from "../api";
import type { ApiOk, ApiPaginated, OrgDTO } from "../../types/api";

export const orgsApi = {
  list: (page = 1, limit = 20) =>
    apiClient
      .get<ApiPaginated<OrgDTO>>("/orgs", { params: { page, limit } })
      .then((r) => r.data),

  get: (id: string) =>
    apiClient.get<ApiOk<OrgDTO>>(`/orgs/${id}`).then((r) => r.data.data),

  create: (data: {
    name: string;
    slug: string;
    plan?: string;
    adminEmail: string;
    adminFirstName: string;
    adminLastName: string;
    adminPassword: string;
  }) =>
    apiClient.post<ApiOk<OrgDTO>>("/orgs", data).then((r) => r.data.data),

  update: (id: string, data: Partial<{ name: string; plan: string; settings: Record<string, unknown>; is_active: boolean }>) =>
    apiClient.patch<ApiOk<OrgDTO>>(`/orgs/${id}`, data).then((r) => r.data.data),
};
