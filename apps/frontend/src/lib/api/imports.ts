import { apiClient } from "../api";
import type {
  ApiOk,
  ApiPaginated,
  UploadedListDTO,
  UploadedContactDTO,
  ContactWithListDTO,
  ImportChannel,
  ImportStatus,
  ApprovalStatus,
} from "../../types/api";

export interface UploadListParams {
  channel: ImportChannel;
  name: string;
  file: File;
}

export interface ListUploadsParams {
  page?: number;
  limit?: number;
  channel?: ImportChannel;
  status?: ImportStatus;
  approvalStatus?: ApprovalStatus;
}

export interface ListContactsParams {
  page?: number;
  limit?: number;
  isValid?: boolean;
  isSuppressed?: boolean;
}

export interface AllContactsParams {
  page?: number;
  limit?: number;
  listId?: string;
  channel?: ImportChannel;
  isValid?: boolean;
  isSuppressed?: boolean;
}

export interface ApproveUploadParams {
  id: string;
  action: "approve" | "reject";
  rejectionReason?: string;
}

export const importsApi = {
  upload: async ({ channel, name, file }: UploadListParams): Promise<UploadedListDTO> => {
    const form = new FormData();
    form.append("file", file);
    form.append("channel", channel);
    form.append("name", name);
    const res = await apiClient.post<ApiOk<UploadedListDTO>>("/imports/upload", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data.data;
  },

  list: (params?: ListUploadsParams) =>
    apiClient
      .get<ApiPaginated<UploadedListDTO>>("/imports/lists", { params })
      .then((r) => r.data),

  get: (id: string) =>
    apiClient
      .get<ApiOk<UploadedListDTO>>(`/imports/lists/${id}`)
      .then((r) => r.data.data),

  getContacts: (id: string, params?: ListContactsParams) =>
    apiClient
      .get<ApiPaginated<UploadedContactDTO>>(`/imports/lists/${id}/contacts`, { params })
      .then((r) => r.data),

  getAllContacts: (params?: AllContactsParams) =>
    apiClient
      .get<ApiPaginated<ContactWithListDTO>>("/imports/contacts", { params })
      .then((r) => r.data),

  delete: (id: string) => apiClient.delete(`/imports/lists/${id}`),

  approve: ({ id, action, rejectionReason }: ApproveUploadParams) =>
    apiClient
      .post<ApiOk<UploadedListDTO>>(`/imports/lists/${id}/approve`, { action, rejectionReason })
      .then((r) => r.data.data),

  pendingApprovals: (params?: { page?: number; limit?: number }) =>
    apiClient
      .get<ApiPaginated<UploadedListDTO>>("/imports/pending-approvals", { params })
      .then((r) => r.data),
};
