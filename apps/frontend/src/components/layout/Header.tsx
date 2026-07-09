"use client";

import { useState } from "react";
import { Bell, ChevronDown, LogOut, User, KeyRound, Check } from "lucide-react";
import { useCurrentUser, useLogout } from "../../hooks/useAuth";
import { useNotifications, useUnreadCount, useMarkRead, useMarkAllRead } from "../../hooks/useNotifications";
import { RoleBadge } from "../ui/Badge";

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { data: unread = 0 } = useUnreadCount();
  const { data } = useNotifications(1);
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  const notifications = data?.notifications ?? [];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((p) => !p)}
        className="relative rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-80 rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-900">Notifications</p>
              {unread > 0 && (
                <button
                  onClick={() => markAllRead.mutate()}
                  className="text-xs text-brand-600 hover:underline flex items-center gap-1"
                >
                  <Check className="h-3 w-3" /> Mark all read
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
              {notifications.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-gray-400">No notifications</p>
              ) : (
                notifications.slice(0, 10).map((n) => (
                  <div
                    key={n.id}
                    className={`px-4 py-3 cursor-pointer hover:bg-gray-50 ${!n.isRead ? "bg-brand-50/40" : ""}`}
                    onClick={() => { if (!n.isRead) markRead.mutate(n.id); }}
                  >
                    <div className="flex items-start gap-2">
                      {!n.isRead && <span className="mt-1.5 h-2 w-2 rounded-full bg-brand-500 flex-shrink-0" />}
                      <div className={!n.isRead ? "" : "ml-4"}>
                        <p className="text-sm font-medium text-gray-900 leading-tight">{n.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{n.body}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(n.createdAt))}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function Header() {
  const user = useCurrentUser();
  const { mutate: logout, isPending } = useLogout();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!user) return null;

  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
      {/* Left: page title placeholder — pages inject via context or slot */}
      <div />

      {/* Right actions */}
      <div className="flex items-center gap-4">
        <NotificationBell />

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen((p) => !p)}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-gray-100 transition-colors"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-brand-700 font-semibold text-xs">
              {user.firstName[0]}{user.lastName[0]}
            </div>
            <div className="hidden md:block text-left">
              <p className="font-medium text-gray-900 leading-tight">
                {user.firstName} {user.lastName}
              </p>
              <RoleBadge role={user.role} />
            </div>
            <ChevronDown className="h-4 w-4 text-gray-400" />
          </button>

          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 z-20 mt-1 w-52 rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
                <div className="px-4 py-2 border-b border-gray-100">
                  <p className="text-sm font-medium text-gray-900">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{user.email}</p>
                </div>
                <button
                  className="flex w-full items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  onClick={() => setMenuOpen(false)}
                >
                  <User className="h-4 w-4" /> Profile
                </button>
                <button
                  className="flex w-full items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  onClick={() => setMenuOpen(false)}
                >
                  <KeyRound className="h-4 w-4" /> Change Password
                </button>
                <div className="my-1 border-t border-gray-100" />
                <button
                  disabled={isPending}
                  className="flex w-full items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  onClick={() => { setMenuOpen(false); logout(); }}
                >
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
