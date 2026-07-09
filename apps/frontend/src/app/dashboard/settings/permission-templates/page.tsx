"use client";

import { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import {
  usePermissionTemplates,
  useCreatePermissionTemplate,
  useDeletePermissionTemplate,
} from "../../../../hooks/useUsers";
import { Button } from "../../../../components/ui/Button";
import { Input } from "../../../../components/ui/Input";
import { Modal } from "../../../../components/ui/Modal";
import { PageSpinner } from "../../../../components/ui/Spinner";
import type { UserPermissions } from "../../../../types/api";

const PERM_LABELS: Record<keyof UserPermissions, string> = {
  upload_calling_data: "Upload calling data",
  log_calls: "Log calls",
  upload_email_data: "Upload email data",
  send_email_campaigns: "Send email campaigns",
  upload_whatsapp_data: "Upload WhatsApp data",
  send_whatsapp_campaigns: "Send WhatsApp campaigns",
  upload_sms_data: "Upload SMS data",
  send_sms_campaigns: "Send SMS campaigns",
  view_assigned_leads: "View assigned leads",
  view_team_leads: "View team leads",
  view_all_leads: "View all leads",
  export_data: "Export data",
  view_reports: "View reports",
  manage_users: "Manage users",
  manage_templates: "Manage templates",
  manage_sender_identities: "Manage sender identities",
  manage_automation: "Manage automation",
  manage_org_settings: "Manage org settings",
};

const DEFAULT_PERMS: UserPermissions = Object.fromEntries(
  Object.keys(PERM_LABELS).map((k) => [k, false])
) as UserPermissions;

export default function PermissionTemplatesPage() {
  const { data: templates, isLoading } = usePermissionTemplates();
  const createTpl = useCreatePermissionTemplate();
  const deleteTpl = useDeletePermissionTemplate();
  const [open, setOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [perms, setPerms] = useState<UserPermissions>(DEFAULT_PERMS);

  function toggle(k: keyof UserPermissions) {
    setPerms((p) => ({ ...p, [k]: !p[k] }));
  }

  async function handleCreate() {
    if (!name.trim()) return;
    await createTpl.mutateAsync({ name: name.trim(), permissions: perms });
    setOpen(false);
    setName("");
    setPerms(DEFAULT_PERMS);
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Permission Templates</h1>
          <p className="text-sm text-gray-500 mt-1">
            Reusable permission sets you can apply to many users at once.
          </p>
        </div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>
          New Template
        </Button>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <PageSpinner />
        ) : (
          <ul className="divide-y divide-gray-100">
            {templates?.map((tpl) => {
              const isExpanded = expandedId === tpl.id;
              const enabledCount = Object.values(tpl.permissions).filter(Boolean).length;
              return (
                <li key={tpl.id}>
                  <div className="flex items-center justify-between px-4 py-3">
                    <button
                      className="flex items-center gap-2 text-sm font-medium text-gray-900"
                      onClick={() => setExpandedId(isExpanded ? null : tpl.id)}
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      )}
                      {tpl.name}
                      <span className="text-xs text-gray-400 font-normal">
                        ({enabledCount} permissions)
                      </span>
                    </button>
                    <button
                      onClick={() => deleteTpl.mutate(tpl.id)}
                      className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  {isExpanded && (
                    <div className="bg-gray-50 px-4 pb-4 pt-2 grid grid-cols-2 gap-x-6 gap-y-1">
                      {(Object.entries(PERM_LABELS) as Array<[keyof UserPermissions, string]>).map(
                        ([k, label]) => (
                          <div key={k} className="flex items-center gap-2 text-sm">
                            <span
                              className={`h-2 w-2 rounded-full ${tpl.permissions[k] ? "bg-green-500" : "bg-gray-300"}`}
                            />
                            <span className="text-gray-600">{label}</span>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </li>
              );
            })}
            {templates?.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-gray-400">
                No templates yet.
              </li>
            )}
          </ul>
        )}
      </div>

      {/* Create modal */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New Permission Template"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button loading={createTpl.isPending} onClick={handleCreate}>
              Create
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Template Name"
            placeholder="e.g. Telecaller"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <div>
            <p className="label mb-2">Permissions</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 border border-gray-200 rounded-lg p-4">
              {(Object.entries(PERM_LABELS) as Array<[keyof UserPermissions, string]>).map(
                ([k, label]) => (
                  <label key={k} className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={Boolean(perms[k])}
                      onChange={() => toggle(k)}
                      className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                    />
                    {label}
                  </label>
                )
              )}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
