"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft,
  Phone,
  Mail,
  Building2,
  User,
  Tag,
  Plus,
  CheckCircle2,
  Clock,
  Pencil,
} from "lucide-react";
import { useLead, useUpdateLead, useAddNote, useCreateTask, useCompleteTask } from "../../../../hooks/useLeads";
import { Modal } from "../../../../components/ui/Modal";
import { Button } from "../../../../components/ui/Button";
import { Input } from "../../../../components/ui/Input";
import { Select } from "../../../../components/ui/Select";
import { Textarea } from "../../../../components/ui/Textarea";
import { Tabs, TabList, Tab, TabPanel } from "../../../../components/ui/Tabs";
import { ActivityTimeline } from "../../../../components/leads/ActivityTimeline";
import { PageSpinner } from "../../../../components/ui/Spinner";
import { isAxiosError } from "axios";
import type { LeadStatus, LeadSource, TaskDTO } from "../../../../types/api";

// ─── Display helpers ──────────────────────────────────────────────────────────

const STATUS_COLORS: Record<LeadStatus, string> = {
  new: "bg-blue-100 text-blue-700",
  contacted: "bg-yellow-100 text-yellow-700",
  interested: "bg-green-100 text-green-700",
  follow_up: "bg-purple-100 text-purple-700",
  converted: "bg-emerald-100 text-emerald-700",
  dead: "bg-gray-100 text-gray-500",
  do_not_contact: "bg-red-100 text-red-700",
};

const STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  interested: "Interested",
  follow_up: "Follow-up",
  converted: "Converted",
  dead: "Dead",
  do_not_contact: "DNC",
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const noteSchema = z.object({
  body: z.string().min(1, "Note cannot be empty"),
  followUpAt: z.string().optional(),
});

const taskSchema = z.object({
  title: z.string().min(1, "Required"),
  dueAt: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
});

const editSchema = z.object({
  name: z.string().min(1, "Required"),
  company: z.string().optional(),
  designation: z.string().optional(),
  status: z.enum([
    "new",
    "contacted",
    "interested",
    "follow_up",
    "converted",
    "dead",
    "do_not_contact",
  ]),
  source: z.enum([
    "cold_call",
    "cold_email",
    "whatsapp",
    "sms",
    "website_inbound",
    "manual",
  ]),
  notes: z.string().optional(),
});

type NoteForm = z.infer<typeof noteSchema>;
type TaskForm = z.infer<typeof taskSchema>;
type EditForm = z.infer<typeof editSchema>;

// ─── Task row ─────────────────────────────────────────────────────────────────

function TaskRow({ task, leadId }: { task: TaskDTO; leadId: string }) {
  const completeTask = useCompleteTask();
  const isOverdue =
    !task.completedAt &&
    task.dueAt &&
    new Date(task.dueAt) < new Date();

  return (
    <div
      className={`flex items-start gap-3 rounded-lg border p-3 ${
        task.completedAt
          ? "border-gray-100 bg-gray-50 opacity-60"
          : isOverdue
          ? "border-red-200 bg-red-50"
          : "border-gray-200 bg-white"
      }`}
    >
      <button
        disabled={!!task.completedAt || completeTask.isPending}
        onClick={() => completeTask.mutate({ leadId, taskId: task.id })}
        className="mt-0.5 shrink-0 text-gray-400 hover:text-green-600 disabled:cursor-default"
      >
        <CheckCircle2
          className={`h-5 w-5 ${task.completedAt ? "text-green-500" : ""}`}
        />
      </button>
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-medium ${
            task.completedAt ? "line-through text-gray-400" : "text-gray-800"
          }`}
        >
          {task.title}
        </p>
        {task.dueAt && (
          <p
            className={`text-xs mt-0.5 flex items-center gap-1 ${
              isOverdue ? "text-red-600" : "text-gray-400"
            }`}
          >
            <Clock className="h-3 w-3" />
            {formatDateTime(task.dueAt)}
            {isOverdue && " (overdue)"}
          </p>
        )}
      </div>
      <span
        className={`text-xs rounded px-1.5 py-0.5 font-medium ${
          task.priority === "high"
            ? "bg-red-100 text-red-700"
            : task.priority === "medium"
            ? "bg-yellow-100 text-yellow-700"
            : "bg-gray-100 text-gray-500"
        }`}
      >
        {task.priority}
      </span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LeadDetailPage({ 
  params 
}: { 
  params: { id: string } // Fixed type
}) {
  const { id } = params; // Direct access, no use() needed
  const router = useRouter();
  const { data: lead, isLoading } = useLead(id);
  const updateLead = useUpdateLead();
  const addNote = useAddNote();
  const createTask = useCreateTask();

  const [editOpen, setEditOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [apiError, setApiError] = useState("");

  const editForm = useForm<EditForm>({ resolver: zodResolver(editSchema) });
  const noteForm = useForm<NoteForm>({ resolver: zodResolver(noteSchema) });
  const taskForm = useForm<TaskForm>({
    resolver: zodResolver(taskSchema),
    defaultValues: { priority: "medium" },
  });

  function handleEditOpen() {
    if (!lead) return;
    editForm.reset({
      name: lead.name,
      company: lead.company ?? "",
      designation: lead.designation ?? "",
      status: lead.status,
      source: lead.source,
      notes: lead.notes ?? "",
    });
    setEditOpen(true);
  }

  async function handleEditSave(values: EditForm) {
    setApiError("");
    try {
      await updateLead.mutateAsync({
        id,
        data: {
          name: values.name,
          company: values.company || null,
          designation: values.designation || null,
          status: values.status,
          source: values.source,
          notes: values.notes || null,
        },
      });
      setEditOpen(false);
    } catch (err) {
      setApiError(isAxiosError(err) ? (err.response?.data as any)?.message : "Error");
    }
  }

  async function handleNoteSubmit(values: NoteForm) {
    await addNote.mutateAsync({
      id,
      body: values.body,
      followUpAt: values.followUpAt || null,
    });
    noteForm.reset();
    setNoteOpen(false);
  }

  async function handleTaskSubmit(values: TaskForm) {
    await createTask.mutateAsync({
      id,
      data: {
        title: values.title,
        dueAt: values.dueAt || null,
        priority: values.priority,
      },
    });
    taskForm.reset();
    setTaskOpen(false);
  }

  if (isLoading) return <PageSpinner />;
  if (!lead) return <p className="text-gray-500">Lead not found.</p>;

  const openTasks = lead.tasks.filter((t) => !t.completedAt);
  const doneTasks = lead.tasks.filter((t) => t.completedAt);

  return (
    <div>
      {/* Back + header */}
      <div className="mb-6">
        <button
          onClick={() => router.push("/dashboard/leads")}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-4"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Leads
        </button>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{lead.name}</h1>
            {lead.company && (
              <p className="text-gray-500 text-sm mt-0.5 flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5" /> {lead.company}
                {lead.designation && ` · ${lead.designation}`}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 text-sm font-medium ${STATUS_COLORS[lead.status]}`}
            >
              {STATUS_LABELS[lead.status]}
            </span>
            <Button variant="secondary" size="sm" leftIcon={<Pencil className="h-3.5 w-3.5" />} onClick={handleEditOpen}>
              Edit
            </Button>
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: info panel */}
        <div className="space-y-5">
          {/* Contact info */}
          <div className="card p-5 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Contact</h3>

            {lead.phones.length > 0 ? (
              lead.phones.map((p) => (
                <div key={p.id} className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-gray-400 shrink-0" />
                  <span className="text-gray-800">{p.phone}</span>
                  {p.isPrimary && (
                    <span className="text-xs text-gray-400">(primary)</span>
                  )}
                </div>
              ))
            ) : (
              <p className="text-xs text-gray-400 flex items-center gap-2">
                <Phone className="h-4 w-4" /> No phone
              </p>
            )}

            {lead.emails.length > 0 ? (
              lead.emails.map((e) => (
                <div key={e.id} className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-gray-400 shrink-0" />
                  <span className="text-gray-800 break-all">{e.email}</span>
                  {e.isPrimary && (
                    <span className="text-xs text-gray-400">(primary)</span>
                  )}
                </div>
              ))
            ) : (
              <p className="text-xs text-gray-400 flex items-center gap-2">
                <Mail className="h-4 w-4" /> No email
              </p>
            )}
          </div>

          {/* Details */}
          <div className="card p-5 space-y-3 text-sm">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Details</h3>
            <div className="grid grid-cols-2 gap-y-2">
              <span className="text-gray-400">Source</span>
              <span className="text-gray-800 capitalize">{lead.source.replace(/_/g, " ")}</span>
              <span className="text-gray-400">Assigned To</span>
              <span className="text-gray-800">{lead.assignedToName ?? "Unassigned"}</span>
              <span className="text-gray-400">Created</span>
              <span className="text-gray-800">{formatDate(lead.createdAt)}</span>
              <span className="text-gray-400">Updated</span>
              <span className="text-gray-800">{formatDate(lead.updatedAt)}</span>
            </div>
            {lead.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {lead.tags.map((t) => (
                  <span
                    key={t}
                    className="flex items-center gap-1 rounded-full bg-blue-50 text-blue-700 text-xs px-2 py-0.5"
                  >
                    <Tag className="h-3 w-3" /> {t}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          {lead.notes && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">Notes</h3>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{lead.notes}</p>
            </div>
          )}

          {/* Tasks */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Tasks {openTasks.length > 0 && <span className="text-blue-600">({openTasks.length})</span>}
              </h3>
              <button
                onClick={() => setTaskOpen(true)}
                className="text-xs text-brand-600 hover:underline flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
            </div>
            <div className="space-y-2">
              {openTasks.map((t) => (
                <TaskRow key={t.id} task={t} leadId={id} />
              ))}
              {doneTasks.map((t) => (
                <TaskRow key={t.id} task={t} leadId={id} />
              ))}
              {lead.tasks.length === 0 && (
                <p className="text-xs text-gray-400">No tasks yet.</p>
              )}
            </div>
          </div>
        </div>

        {/* Right: activity timeline */}
        <div className="lg:col-span-2">
          <div className="card p-5">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Activity Timeline
              </h3>
              <Button
                size="sm"
                leftIcon={<Plus className="h-3.5 w-3.5" />}
                onClick={() => setNoteOpen(true)}
              >
                Add Note
              </Button>
            </div>
            <ActivityTimeline activities={lead.activities} />
          </div>
        </div>
      </div>

      {/* ── Edit Lead Modal ────────────────────────────────────────────────── */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Lead"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button loading={updateLead.isPending} onClick={editForm.handleSubmit(handleEditSave)}>
              Save Changes
            </Button>
          </>
        }
      >
        {apiError && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {apiError}
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Input
              label="Full Name"
              required
              error={editForm.formState.errors.name?.message}
              {...editForm.register("name")}
            />
          </div>
          <Input label="Company" {...editForm.register("company")} />
          <Input label="Designation" {...editForm.register("designation")} />
          <Select
            label="Status"
            options={[
              { value: "new", label: "New" },
              { value: "contacted", label: "Contacted" },
              { value: "interested", label: "Interested" },
              { value: "follow_up", label: "Follow-up" },
              { value: "converted", label: "Converted" },
              { value: "dead", label: "Dead" },
              { value: "do_not_contact", label: "Do Not Contact" },
            ]}
            {...editForm.register("status")}
          />
          <Select
            label="Source"
            options={[
              { value: "manual", label: "Manual" },
              { value: "cold_call", label: "Cold Call" },
              { value: "cold_email", label: "Cold Email" },
              { value: "whatsapp", label: "WhatsApp" },
              { value: "sms", label: "SMS" },
              { value: "website_inbound", label: "Website Inbound" },
            ]}
            {...editForm.register("source")}
          />
          <div className="col-span-2">
            <Textarea label="Notes" {...editForm.register("notes")} />
          </div>
        </div>
      </Modal>

      {/* ── Add Note Modal ─────────────────────────────────────────────────── */}
      <Modal
        open={noteOpen}
        onClose={() => { setNoteOpen(false); noteForm.reset(); }}
        title="Add Note"
        footer={
          <>
            <Button variant="secondary" onClick={() => setNoteOpen(false)}>Cancel</Button>
            <Button loading={addNote.isPending} onClick={noteForm.handleSubmit(handleNoteSubmit)}>
              Save Note
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Textarea
            label="Note"
            required
            rows={4}
            error={noteForm.formState.errors.body?.message}
            {...noteForm.register("body")}
          />
          <Input
            label="Schedule Follow-up"
            type="datetime-local"
            hint="Optional — creates a follow-up task"
            {...noteForm.register("followUpAt")}
          />
        </div>
      </Modal>

      {/* ── Create Task Modal ──────────────────────────────────────────────── */}
      <Modal
        open={taskOpen}
        onClose={() => { setTaskOpen(false); taskForm.reset(); }}
        title="Create Task"
        footer={
          <>
            <Button variant="secondary" onClick={() => setTaskOpen(false)}>Cancel</Button>
            <Button loading={createTask.isPending} onClick={taskForm.handleSubmit(handleTaskSubmit)}>
              Create Task
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Task Title"
            required
            error={taskForm.formState.errors.title?.message}
            {...taskForm.register("title")}
          />
          <Input
            label="Due Date & Time"
            type="datetime-local"
            {...taskForm.register("dueAt")}
          />
          <Select
            label="Priority"
            options={[
              { value: "low", label: "Low" },
              { value: "medium", label: "Medium" },
              { value: "high", label: "High" },
            ]}
            {...taskForm.register("priority")}
          />
        </div>
      </Modal>
    </div>
  );
}
