"use client";

import { useState } from "react";
import { Plus, Trash2, Users } from "lucide-react";
import { useTeams, useCreateTeam, useDeleteTeam } from "../../../../hooks/useUsers";
import { useUsers } from "../../../../hooks/useUsers";
import { Button } from "../../../../components/ui/Button";
import { Input } from "../../../../components/ui/Input";
import { Select } from "../../../../components/ui/Select";
import { Modal } from "../../../../components/ui/Modal";
import { PageSpinner } from "../../../../components/ui/Spinner";

export default function TeamsPage() {
  const { data: teams, isLoading } = useTeams();
  const { data: usersData } = useUsers({ limit: 200 });
  const createTeam = useCreateTeam();
  const deleteTeam = useDeleteTeam();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [managerId, setManagerId] = useState("");

  const managerOptions = [
    { value: "", label: "No manager" },
    ...(usersData?.data
      .filter((u) => u.role === "manager" || u.role === "admin")
      .map((u) => ({ value: u.id, label: u.fullName })) ?? []),
  ];

  async function handleCreate() {
    if (!name.trim()) return;
    await createTeam.mutateAsync({ name: name.trim(), managerId: managerId || null });
    setOpen(false);
    setName("");
    setManagerId("");
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Teams</h1>
          <p className="text-sm text-gray-500 mt-1">Organise employees into groups.</p>
        </div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>
          New Team
        </Button>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <PageSpinner />
        ) : (
          <ul className="divide-y divide-gray-100">
            {teams?.map((t) => (
              <li key={t.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100">
                    <Users className="h-4 w-4 text-brand-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{t.name}</p>
                    <p className="text-xs text-gray-400">
                      {t.memberCount} member{t.memberCount !== 1 ? "s" : ""}
                      {t.managerName ? ` · Manager: ${t.managerName}` : ""}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => deleteTeam.mutate(t.id)}
                  className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
            {teams?.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-gray-400">No teams yet.</li>
            )}
          </ul>
        )}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Create Team"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button loading={createTeam.isPending} onClick={handleCreate}>Create</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Team Name"
            placeholder="e.g. North India Sales"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Select
            label="Manager"
            options={managerOptions}
            value={managerId}
            onChange={(e) => setManagerId(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
}
