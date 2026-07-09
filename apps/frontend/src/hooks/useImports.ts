"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  importsApi,
  type UploadListParams,
  type ListUploadsParams,
  type ListContactsParams,
  type AllContactsParams,
  type ApproveUploadParams,
} from "../lib/api/imports";

export const importKeys = {
  all: ["imports"] as const,
  lists: (params?: ListUploadsParams) => ["imports", "lists", params] as const,
  list: (id: string) => ["imports", "list", id] as const,
  contacts: (id: string, params?: ListContactsParams) => ["imports", "contacts", id, params] as const,
  allContacts: (params?: AllContactsParams) => ["imports", "all-contacts", params] as const,
};

export function useImportLists(params?: ListUploadsParams) {
  // Poll every 5 seconds if any list is currently processing
  return useQuery({
    queryKey: importKeys.lists(params),
    queryFn: () => importsApi.list(params),
    refetchInterval: (query) => {
      const data = query.state.data;
      const needsRefetch = data?.data.some(
        (l) =>
          l.status === "pending" ||
          l.status === "processing" ||
          l.approvalStatus === "pending"
      );
      return needsRefetch ? 5000 : false;
    },
  });
}

export function useImportList(id: string) {
  return useQuery({
    queryKey: importKeys.list(id),
    queryFn: () => importsApi.get(id),
    enabled: !!id,
    // Poll while pending/processing
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "pending" || status === "processing" ? 3000 : false;
    },
  });
}

export function useImportContacts(id: string, params?: ListContactsParams) {
  return useQuery({
    queryKey: importKeys.contacts(id, params),
    queryFn: () => importsApi.getContacts(id, params),
    enabled: !!id,
  });
}

export function useAllImportContacts(params?: AllContactsParams) {
  return useQuery({
    queryKey: importKeys.allContacts(params),
    queryFn: () => importsApi.getAllContacts(params),
  });
}

export function useUploadList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UploadListParams) => importsApi.upload(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: importKeys.all }),
  });
}

export function useDeleteImportList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => importsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: importKeys.all }),
  });
}

export function useApproveUpload() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: ApproveUploadParams) => importsApi.approve(params),
    onSuccess: () => qc.invalidateQueries({ queryKey: importKeys.all }),
  });
}

export function usePendingApprovals(params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: ["imports", "pending-approvals", params] as const,
    queryFn: () => importsApi.pendingApprovals(params),
  });
}
