"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orgsApi } from "../../../../lib/api/organizations";
import { useCurrentUser } from "../../../../hooks/useAuth";
import { Input } from "../../../../components/ui/Input";
import { Select } from "../../../../components/ui/Select";
import { Button } from "../../../../components/ui/Button";
import { PageSpinner } from "../../../../components/ui/Spinner";
import { isAxiosError } from "axios";

const schema = z.object({
  name: z.string().min(2, "Min 2 characters"),
  plan: z.enum(["starter", "growth", "enterprise"]),
});

type FormValues = z.infer<typeof schema>;

export default function OrgSettingsPage() {
  const user = useCurrentUser();
  const qc = useQueryClient();

  const { data: org, isLoading } = useQuery({
    queryKey: ["org", user?.organisationId],
    queryFn: () => orgsApi.get(user!.organisationId),
    enabled: !!user,
  });

  const updateOrg = useMutation({
    mutationFn: (data: FormValues) => orgsApi.update(user!.organisationId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org"] }),
  });

  const { register, handleSubmit, formState: { errors, isDirty } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: org ? { name: org.name, plan: org.plan as FormValues["plan"] } : undefined,
  });

  if (isLoading) return <PageSpinner />;
  if (!org) return null;

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Organisation Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your organisation details.</p>
      </div>

      <div className="card p-6">
        <form onSubmit={handleSubmit((d) => updateOrg.mutate(d))} className="space-y-5">
          <Input
            label="Organisation Name"
            required
            error={errors.name?.message}
            {...register("name")}
          />

          <div>
            <label className="label">Slug</label>
            <input className="input bg-gray-50 cursor-not-allowed" value={org.slug} disabled />
            <p className="mt-1 text-xs text-gray-400">Slug cannot be changed after creation.</p>
          </div>

          <Select
            label="Plan"
            options={[
              { value: "starter", label: "Starter" },
              { value: "growth", label: "Growth" },
              { value: "enterprise", label: "Enterprise" },
            ]}
            {...register("plan")}
          />

          {updateOrg.isError && (
            <p className="text-sm text-red-600">
              {isAxiosError(updateOrg.error)
                ? (updateOrg.error.response?.data as any)?.message
                : "Update failed"}
            </p>
          )}
          {updateOrg.isSuccess && (
            <p className="text-sm text-green-600">Settings saved.</p>
          )}

          <div className="flex justify-end">
            <Button type="submit" loading={updateOrg.isPending} disabled={!isDirty}>
              Save Changes
            </Button>
          </div>
        </form>
      </div>

      {/* Read-only info */}
      <div className="card p-6 mt-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Organisation Info</h3>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-500">Organisation ID</dt>
            <dd className="font-mono text-xs text-gray-700">{org.id}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Total Users</dt>
            <dd className="font-semibold text-gray-900">{org.user_count}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Created</dt>
            <dd className="text-gray-700">{new Date(org.created_at).toLocaleDateString()}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
