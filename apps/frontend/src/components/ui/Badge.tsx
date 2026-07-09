import { clsx } from "clsx";

type Color = "blue" | "green" | "yellow" | "red" | "gray" | "purple" | "indigo";

interface BadgeProps {
  children: React.ReactNode;
  color?: Color;
  className?: string;
}

const colorCls: Record<Color, string> = {
  blue: "bg-blue-100 text-blue-700",
  green: "bg-green-100 text-green-700",
  yellow: "bg-yellow-100 text-yellow-700",
  red: "bg-red-100 text-red-700",
  gray: "bg-gray-100 text-gray-700",
  purple: "bg-purple-100 text-purple-700",
  indigo: "bg-indigo-100 text-indigo-700",
};

export function Badge({ children, color = "gray", className }: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        colorCls[color],
        className
      )}
    >
      {children}
    </span>
  );
}

// Pre-built role badge
export function RoleBadge({ role }: { role: string }) {
  const map: Record<string, { label: string; color: Color }> = {
    super_admin: { label: "Super Admin", color: "purple" },
    admin: { label: "Admin", color: "indigo" },
    manager: { label: "Manager", color: "blue" },
    employee: { label: "Employee", color: "gray" },
  };
  const { label, color } = map[role] ?? { label: role, color: "gray" };
  return <Badge color={color}>{label}</Badge>;
}

export function StatusBadge({ active }: { active: boolean }) {
  return (
    <Badge color={active ? "green" : "red"}>{active ? "Active" : "Inactive"}</Badge>
  );
}
