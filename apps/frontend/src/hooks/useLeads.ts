"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  leadsApi,
  type LeadListParams,
  type CreateLeadPayload,
  type UpdateLeadPayload,
} from "../lib/api/leads";

export const leadKeys = {
  all: ["leads"] as const,
  list: (params?: LeadListParams) => ["leads", "list", params] as const,
  detail: (id: string) => ["leads", "detail", id] as const,
};

export function useLeads(params?: LeadListParams) {
  return useQuery({
    queryKey: leadKeys.list(params),
    queryFn: () => leadsApi.list(params),
  });
}

export function useLead(id: string) {
  return useQuery({
    queryKey: leadKeys.detail(id),
    queryFn: () => leadsApi.get(id),
    enabled: !!id,
  });
}

export function useCreateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateLeadPayload) => leadsApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: leadKeys.all }),
  });
}

export function useUpdateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateLeadPayload }) =>
      leadsApi.update(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: leadKeys.all });
      qc.invalidateQueries({ queryKey: leadKeys.detail(id) });
    },
  });
}

export function useAssignLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string }) =>
      leadsApi.assign(id, userId),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: leadKeys.all });
      qc.invalidateQueries({ queryKey: leadKeys.detail(id) });
    },
  });
}

export function useAddNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      body,
      followUpAt,
    }: {
      id: string;
      body: string;
      followUpAt?: string | null;
    }) => leadsApi.addNote(id, body, followUpAt),
    onSuccess: (_, { id }) => qc.invalidateQueries({ queryKey: leadKeys.detail(id) }),
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: {
        title: string;
        dueAt?: string | null;
        type?: string;
        priority?: string;
        assignedTo?: string;
      };
    }) => leadsApi.createTask(id, data),
    onSuccess: (_, { id }) => qc.invalidateQueries({ queryKey: leadKeys.detail(id) }),
  });
}

export function useCompleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ leadId, taskId }: { leadId: string; taskId: string }) =>
      leadsApi.completeTask(leadId, taskId),
    onSuccess: (_, { leadId }) => qc.invalidateQueries({ queryKey: leadKeys.detail(leadId) }),
  });
}

export function useAddPhone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      phone,
      isPrimary,
      isWhatsapp,
    }: {
      id: string;
      phone: string;
      isPrimary?: boolean;
      isWhatsapp?: boolean;
    }) => leadsApi.addPhone(id, phone, isPrimary, isWhatsapp),
    onSuccess: (_, { id }) => qc.invalidateQueries({ queryKey: leadKeys.detail(id) }),
  });
}

export function useDeletePhone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, phoneId }: { id: string; phoneId: string }) =>
      leadsApi.deletePhone(id, phoneId),
    onSuccess: (_, { id }) => qc.invalidateQueries({ queryKey: leadKeys.detail(id) }),
  });
}

export function useAddEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      email,
      isPrimary,
    }: {
      id: string;
      email: string;
      isPrimary?: boolean;
    }) => leadsApi.addEmail(id, email, isPrimary),
    onSuccess: (_, { id }) => qc.invalidateQueries({ queryKey: leadKeys.detail(id) }),
  });
}

export function useDeleteEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, emailId }: { id: string; emailId: string }) =>
      leadsApi.deleteEmail(id, emailId),
    onSuccess: (_, { id }) => qc.invalidateQueries({ queryKey: leadKeys.detail(id) }),
  });
}

export function useCheckDuplicate() {
  return useMutation({
    mutationFn: ({ phones, emails }: { phones: string[]; emails: string[] }) =>
      leadsApi.checkDuplicate(phones, emails),
  });
}
