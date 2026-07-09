"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import {
  LayoutDashboard,
  Users,
  Phone,
  Mail,
  MessageSquare,
  MessageCircle,
  Zap,
  BarChart2,
  Settings,
  ChevronDown,
  Building2,
  Upload,
  Megaphone,
  FileText,
  Radio,
  Webhook,
  Inbox,
  History,
} from "lucide-react";
import { useState } from "react";
import { useCurrentUser } from "../../hooks/useAuth";
import { useInboxStats } from "../../hooks/useInbox";
import type { UserRole } from "../../types/api";

interface NavItem {
  label: string;
  href?: string;
  icon: React.ElementType;
  minRole?: UserRole;
  children?: Omit<NavItem, "children">[];
}

const ROLE_RANK: Record<UserRole, number> = {
  super_admin: 4,
  admin: 3,
  manager: 2,
  employee: 1,
};

function canAccess(minRole: UserRole | undefined, userRole: UserRole): boolean {
  if (!minRole) return true;
  return ROLE_RANK[userRole] >= ROLE_RANK[minRole];
}

const NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Leads", href: "/dashboard/leads", icon: Users },
  { label: "Cold Calling", href: "/dashboard/calling", icon: Phone },
  { label: "Imports", href: "/dashboard/imports", icon: Upload },
  { label: "Campaigns", href: "/dashboard/campaigns", icon: Megaphone },
  { label: "Inbox", href: "/dashboard/inbox", icon: Inbox },
  { label: "Email", href: "/dashboard/email", icon: Mail },
  { label: "WhatsApp", href: "/dashboard/whatsapp", icon: MessageSquare },
  { label: "SMS", href: "/dashboard/sms", icon: MessageCircle },
  { label: "Automation", href: "/dashboard/automation", icon: Zap, minRole: "manager" },
  { label: "Reports", href: "/dashboard/reports", icon: BarChart2, minRole: "manager" },
  {
    label: "Settings",
    icon: Settings,
    minRole: "admin",
    children: [
      { label: "Organisation", href: "/dashboard/settings/org", icon: Building2 },
      { label: "Users", href: "/dashboard/users", icon: Users },
      { label: "Designations", href: "/dashboard/settings/designations", icon: Users },
      { label: "Teams", href: "/dashboard/settings/teams", icon: Users },
      { label: "Permissions", href: "/dashboard/settings/permission-templates", icon: Settings },
      { label: "Senders", href: "/dashboard/settings/senders", icon: Radio },
      { label: "Templates", href: "/dashboard/settings/templates", icon: FileText },
      { label: "Integrations", href: "/dashboard/settings/integrations", icon: Webhook },
      { label: "Audit Log", href: "/dashboard/settings/audit-log", icon: History },
    ],
  },
];

function NavLink({
  item,
  userRole,
  badge,
}: {
  item: NavItem;
  userRole: UserRole;
  badge?: number;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(() =>
    item.children?.some((c) => c.href && pathname.startsWith(c.href)) ?? false
  );

  if (!canAccess(item.minRole, userRole)) return null;

  if (item.children) {
    return (
      <div>
        <button
          onClick={() => setOpen((p) => !p)}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
        >
          <item.icon className="h-5 w-5 flex-shrink-0" />
          {item.label}
          <ChevronDown
            className={clsx(
              "ml-auto h-4 w-4 transition-transform",
              open && "rotate-180"
            )}
          />
        </button>
        {open && (
          <div className="ml-4 mt-1 space-y-1 border-l-2 border-gray-200 pl-3">
            {item.children.map((child) => (
              <Link
                key={child.href}
                href={child.href!}
                className={clsx(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  pathname === child.href
                    ? "bg-brand-50 text-brand-700"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                )}
              >
                <child.icon className="h-4 w-4 flex-shrink-0" />
                {child.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  const active = item.href === "/dashboard"
    ? pathname === item.href
    : pathname.startsWith(item.href!);

  return (
    <Link
      href={item.href!}
      className={clsx(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-brand-50 text-brand-700"
          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
      )}
    >
      <item.icon className="h-5 w-5 flex-shrink-0" />
      <span className="flex-1">{item.label}</span>
      {badge != null && badge > 0 && (
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1.5 text-[10px] font-bold text-white">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  );
}

export function Sidebar() {
  const user = useCurrentUser();
  const { data: inboxStats } = useInboxStats();
  if (!user) return null;

  const unread = inboxStats?.unreadTotal ?? 0;

  return (
    <div className="flex h-full w-64 flex-col border-r border-gray-200 bg-white">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b border-gray-200 px-4">
        <Image
          src="/logo.jpeg"
          alt="CertifyBusiness logo"
          width={44}
          height={44}
          className="rounded-lg object-contain"
        />
        <span className="font-semibold text-gray-900">CertifyBusiness</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {NAV.map((item) => (
          <NavLink
            key={item.label}
            item={item}
            userRole={user.role}
            badge={item.href === "/dashboard/inbox" && unread > 0 ? unread : undefined}
          />
        ))}
      </nav>
    </div>
  );
}
