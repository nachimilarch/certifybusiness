"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { UserPlus, Search, MoreVertical, KeyRound, UserX, UserCheck, Pencil } from "lucide-react";
import { useUsers, useCreateUser, useUpdateUser, useResetPassword, useDesignations } from "../../../hooks/useUsers";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { Badge, RoleBadge, StatusBadge } from "../../../components/ui/Badge";
import { PageSpinner } from "../../../components/ui/Spinner";
import { isAxiosError } from "axios";
import type { UserDTO, UserRole } from "../../../types/api";

// ─── Create/Edit user form schema ─────────────────────────────────────────────

const createSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  password: z.string().min(8),
  role: z.enum(["admin", "manager", "employee"]),
  designationId: z.string().optional(),
});

const editSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.enum(["admin", "manager", "employee"]),
  designationId: z.string().optional(),
  isActive: z.boolean(),
});

type CreateFormValues = z.infer<typeof createSchema>;
type EditFormValues = z.infer<typeof editSchema>;

// ─── Row action menu ─────────────────────────────────────────────────────────

function ActionsMenu({
  user,
  onEdit,
  onResetPw,
  onToggleActive,
}: {
  user: UserDTO;
  onEdit: () => void;
  onResetPw: () => void;
  onToggleActive: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((p) => !p)}
        className="rounded p-1 hover:bg-gray-100 text-gray-400 hover:text-gray-600"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-44 rounded-xl border border-gray-200 bg-white py-1 shadow-lg text-sm">
            <button
              className="flex w-full items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-50"
              onClick={() => { setOpen(false); onEdit(); }}
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
            <button
              className="flex w-full items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-50"
              onClick={() => { setOpen(false); onResetPw(); }}
            >
              <KeyRound className="h-3.5 w-3.5" /> Reset Password
            </button>
            <div className="my-1 border-t border-gray-100" />
            <button
              className={`flex w-full items-center gap-2 px-4 py-2 hover:bg-gray-50 ${user.isActive ? "text-red-600" : "text-green-600"}`}
              onClick={() => { setOpen(false); onToggleActive(); }}
            >
              {user.isActive ? (
                <><UserX className="h-3.5 w-3.5" /> Deactivate</>
              ) : (
                <><UserCheck className="h-3.5 w-3.5" /> Activate</>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "">("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<UserDTO | null>(null);
  const [resetTarget, setResetTarget] = useState<UserDTO | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [apiError, setApiError] = useState("");

  const { data, isLoading } = useUsers({
    page,
    limit: 20,
    search: search || undefined,
    role: roleFilter || undefined,
  });

  const { data: designations = [] } = useDesignations();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const resetPassword = useResetPassword();

  const createForm = useForm<CreateFormValues>({ resolver: zodResolver(createSchema) });
  const editForm = useForm<EditFormValues>({ resolver: zodResolver(editSchema) });

  function handleEditOpen(user: UserDTO) {
    setEditTarget(user);
    editForm.reset({
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role === "super_admin" ? "admin" : user.role,
      designationId: user.designationId ?? "",
      isActive: user.isActive,
    });
  }

  async function handleCreate(values: CreateFormValues) {
    setApiError("");
    try {
      await createUser.mutateAsync({
        ...values,
        designationId: values.designationId || null,
      });
      setCreateOpen(false);
      createForm.reset();
    } catch (err) {
      setApiError(isAxiosError(err) ? (err.response?.data as any)?.message : "Error");
    }
  }

  async function handleEdit(values: EditFormValues) {
    if (!editTarget) return;
    setApiError("");
    try {
      await updateUser.mutateAsync({
        id: editTarget.id,
        data: { ...values, designationId: values.designationId || null },
      });
      setEditTarget(null);
    } catch (err) {
      setApiError(isAxiosError(err) ? (err.response?.data as any)?.message : "Error");
    }
  }

  async function handleResetPassword() {
    if (!resetTarget || !newPassword) return;
    await resetPassword.mutateAsync({ id: resetTarget.id, newPassword });
    setResetTarget(null);
    setNewPassword("");
  }

  async function handleToggleActive(user: UserDTO) {
    await updateUser.mutateAsync({ id: user.id, data: { isActive: !user.isActive } });
  }

  const designationOptions = [
    { value: "", label: "None" },
    ...designations.map((d) => ({ value: d.id, label: d.name })),
  ];

  return (
    <div>
      {/* Page header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-sm text-gray-500 mt-1">
            {data?.meta.total ?? 0} members in your organisation
          </p>
        </div>
        <Button leftIcon={<UserPlus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
          Add User
        </Button>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-5 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select
          className="input w-36"
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value as UserRole | ""); setPage(1); }}
        >
          <option value="">All roles</option>
          <option value="admin">Admin</option>
          <option value="manager">Manager</option>
          <option value="employee">Employee</option>
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <PageSpinner />
        ) : (
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {["Name", "Email", "Role", "Designation", "Manager", "Status", ""].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {data?.data.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-brand-700 font-semibold text-xs flex-shrink-0">
                        {user.firstName[0]}{user.lastName[0]}
                      </div>
                      {user.fullName}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{user.email}</td>
                  <td className="px-4 py-3"><RoleBadge role={user.role} /></td>
                  <td className="px-4 py-3 text-gray-500">{user.designationName ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{user.managerName ?? "—"}</td>
                  <td className="px-4 py-3"><StatusBadge active={user.isActive} /></td>
                  <td className="px-4 py-3 text-right">
                    <ActionsMenu
                      user={user}
                      onEdit={() => handleEditOpen(user)}
                      onResetPw={() => setResetTarget(user)}
                      onToggleActive={() => handleToggleActive(user)}
                    />
                  </td>
                </tr>
              ))}
              {data?.data.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {data && data.meta.pages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
            <p className="text-xs text-gray-500">
              Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, data.meta.total)} of{" "}
              {data.meta.total}
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page === data.meta.pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Create User Modal ─────────────────────────────────────────────── */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add New User"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={createUser.isPending}
              onClick={createForm.handleSubmit(handleCreate)}
            >
              Create User
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
          <Input
            label="First Name"
            required
            error={createForm.formState.errors.firstName?.message}
            {...createForm.register("firstName")}
          />
          <Input
            label="Last Name"
            required
            error={createForm.formState.errors.lastName?.message}
            {...createForm.register("lastName")}
          />
          <div className="col-span-2">
            <Input
              label="Email Address"
              type="email"
              required
              error={createForm.formState.errors.email?.message}
              {...createForm.register("email")}
            />
          </div>
          <Input
            label="Password"
            type="password"
            required
            error={createForm.formState.errors.password?.message}
            hint="Min. 8 characters"
            {...createForm.register("password")}
          />
          <Select
            label="Role"
            required
            options={[
              { value: "employee", label: "Employee" },
              { value: "manager", label: "Manager" },
              { value: "admin", label: "Admin" },
            ]}
            error={createForm.formState.errors.role?.message}
            {...createForm.register("role")}
          />
          <div className="col-span-2">
            <Select
              label="Designation"
              options={designationOptions}
              {...createForm.register("designationId")}
            />
          </div>
        </div>
      </Modal>

      {/* ── Edit User Modal ───────────────────────────────────────────────── */}
      <Modal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Edit User"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditTarget(null)}>
              Cancel
            </Button>
            <Button
              loading={updateUser.isPending}
              onClick={editForm.handleSubmit(handleEdit)}
            >
              Save Changes
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="First Name"
            required
            error={editForm.formState.errors.firstName?.message}
            {...editForm.register("firstName")}
          />
          <Input
            label="Last Name"
            required
            error={editForm.formState.errors.lastName?.message}
            {...editForm.register("lastName")}
          />
          <Select
            label="Role"
            required
            options={[
              { value: "employee", label: "Employee" },
              { value: "manager", label: "Manager" },
              { value: "admin", label: "Admin" },
            ]}
            {...editForm.register("role")}
          />
          <Select
            label="Designation"
            options={designationOptions}
            {...editForm.register("designationId")}
          />
          <div className="col-span-2 flex items-center gap-3">
            <input
              type="checkbox"
              id="isActive"
              className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
              {...editForm.register("isActive")}
            />
            <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
              Account active
            </label>
          </div>
        </div>
      </Modal>

      {/* ── Reset Password Modal ──────────────────────────────────────────── */}
      <Modal
        open={!!resetTarget}
        onClose={() => setResetTarget(null)}
        title="Reset Password"
        footer={
          <>
            <Button variant="secondary" onClick={() => setResetTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={resetPassword.isPending}
              onClick={handleResetPassword}
            >
              Reset Password
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600 mb-4">
          Set a new password for <strong>{resetTarget?.fullName}</strong>. Their active sessions
          will be invalidated.
        </p>
        <Input
          label="New Password"
          type="password"
          required
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          hint="Min. 8 characters"
        />
      </Modal>
    </div>
  );
}
