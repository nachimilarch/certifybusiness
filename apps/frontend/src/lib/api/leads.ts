import { apiClient } from "../api";
import type {
  ApiOk,
  ApiPaginated,
  LeadDTO,
  LeadFullDTO,
  ActivityDTO,
  TaskDTO,
  PhoneDTO,
  EmailDTO,
  LeadSource,
  LeadStatus,
} from "../../types/api";

export interface CreateLeadPayload {
  name: string;
  company?: string | null;
  designation?: string | null;
  source?: LeadSource;
  status?: LeadStatus;
  assignedTo?: string | null;
  tags?: string[];
  notes?: string | null;
  phones?: Array<{ phone: string; isPrimary?: boolean; isWhatsapp?: boolean }>;
  emails?: Array<{ email: string; isPrimary?: boolean }>;
}

export interface UpdateLeadPayload {
  name?: string;
  company?: string | null;
  designation?: string | null;
  source?: LeadSource;
  status?: LeadStatus;
  assignedTo?: string | null;
  tags?: string[];
  notes?: string | null;
}

export interface LeadListParams {
  page?: number;
  limit?: number;
  status?: LeadStatus;
  source?: LeadSource;
  assignedTo?: string;
  search?: string;
  tag?: string;
  createdFrom?: string;
  createdTo?: string;
}

export const leadsApi = {
  list: (params?: LeadListParams) =>
    apiClient.get<ApiPaginated<LeadDTO>>("/leads", { params }).then((r) => r.data),

  get: (id: string) =>
    apiClient.get<ApiOk<LeadFullDTO>>(`/leads/${id}`).then((r) => r.data.data),

  create: (data: CreateLeadPayload) =>
    apiClient.post<ApiOk<LeadFullDTO>>("/leads", data).then((r) => r.data.data),

  update: (id: string, data: UpdateLeadPayload) =>
    apiClient.patch<ApiOk<LeadDTO>>(`/leads/${id}`, data).then((r) => r.data.data),

  assign: (id: string, userId: string) =>
    apiClient.post<ApiOk<LeadDTO>>(`/leads/${id}/assign`, { userId }).then((r) => r.data.data),

  checkDuplicate: (phones: string[], emails: string[]) =>
    apiClient
      .post<ApiOk<{ duplicate: { leadId: string; leadName: string; matchedOn: string } | null }>>(
        "/leads/check-duplicate",
        { phones, emails }
      )
      .then((r) => r.data.data),

  addNote: (id: string, body: string, followUpAt?: string | null) =>
    apiClient
      .post<ApiOk<{ activity: ActivityDTO; task?: TaskDTO }>>(`/leads/${id}/notes`, {
        body,
        followUpAt: followUpAt ?? null,
      })
      .then((r) => r.data.data),

  createTask: (
    id: string,
    data: { title: string; dueAt?: string | null; type?: string; priority?: string; assignedTo?: string }
  ) =>
    apiClient.post<ApiOk<TaskDTO>>(`/leads/${id}/tasks`, data).then((r) => r.data.data),

  completeTask: (leadId: string, taskId: string) =>
    apiClient.patch(`/leads/${leadId}/tasks/${taskId}/complete`),

  addPhone: (id: string, phone: string, isPrimary = false, isWhatsapp = false) =>
    apiClient
      .post<ApiOk<PhoneDTO>>(`/leads/${id}/phones`, { phone, isPrimary, isWhatsapp })
      .then((r) => r.data.data),

  deletePhone: (id: string, phoneId: string) =>
    apiClient.delete(`/leads/${id}/phones/${phoneId}`),

  addEmail: (id: string, email: string, isPrimary = false) =>
    apiClient
      .post<ApiOk<EmailDTO>>(`/leads/${id}/emails`, { email, isPrimary })
      .then((r) => r.data.data),

  deleteEmail: (id: string, emailId: string) =>
    apiClient.delete(`/leads/${id}/emails/${emailId}`),
};
