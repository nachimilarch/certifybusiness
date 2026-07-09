"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "../../components/layout/Sidebar";
import { Header } from "../../components/layout/Header";
import { useAuthStore } from "../../lib/auth-store";
import { PageSpinner } from "../../components/ui/Spinner";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, accessToken, _hasHydrated } = useAuthStore();

  useEffect(() => {
    // Don't redirect until Zustand has rehydrated from localStorage.
    // Without this guard the very first render (user=null, token=null) would
    // always kick the user back to /login even when a valid session exists.
    if (!_hasHydrated) return;
    if (!accessToken || !user) {
      router.replace("/login");
    }
  }, [_hasHydrated, accessToken, user, router]);

  if (!_hasHydrated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <PageSpinner />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
