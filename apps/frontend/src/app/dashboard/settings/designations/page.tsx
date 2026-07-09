"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useDesignations, useCreateDesignation, useDeleteDesignation } from "../../../../hooks/useUsers";
import { Button } from "../../../../components/ui/Button";
import { Input } from "../../../../components/ui/Input";
import { PageSpinner } from "../../../../components/ui/Spinner";

export default function DesignationsPage() {
  const { data: designations, isLoading } = useDesignations();
  const createDes = useCreateDesignation();
  const deleteDes = useDeleteDesignation();
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  async function handleAdd() {
    if (!name.trim()) return;
    setError("");
    try {
      await createDes.mutateAsync(name.trim());
      setName("");
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Failed to create");
    }
  }

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Designations</h1>
        <p className="text-sm text-gray-500 mt-1">Labels like BDE, Telecaller, SDR.</p>
      </div>

      {/* Add form */}
      <div className="card p-4 mb-4">
        <div className="flex gap-3">
          <Input
            placeholder="e.g. Business Development Executive"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            error={error}
            className="flex-1"
          />
          <Button
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={handleAdd}
            loading={createDes.isPending}
          >
            Add
          </Button>
        </div>
      </div>

      {/* List */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <PageSpinner />
        ) : (
          <ul className="divide-y divide-gray-100">
            {designations?.map((d) => (
              <li key={d.id} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm font-medium text-gray-900">{d.name}</span>
                <button
                  onClick={() => deleteDes.mutate(d.id)}
                  className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
            {designations?.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-gray-400">
                No designations yet.
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
