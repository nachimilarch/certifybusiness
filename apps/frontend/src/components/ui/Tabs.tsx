"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

interface TabsContextValue {
  active: string;
  setActive: (id: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("Tabs subcomponents must be inside <Tabs>");
  return ctx;
}

interface TabsProps {
  defaultTab: string;
  children: ReactNode;
  className?: string;
}

export function Tabs({ defaultTab, children, className = "" }: TabsProps) {
  const [active, setActive] = useState(defaultTab);
  return (
    <TabsContext.Provider value={{ active, setActive }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabList({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`flex border-b border-gray-200 ${className}`}>
      {children}
    </div>
  );
}

export function Tab({ id, children }: { id: string; children: ReactNode }) {
  const { active, setActive } = useTabsContext();
  const isActive = active === id;
  return (
    <button
      type="button"
      onClick={() => setActive(id)}
      className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
        isActive
          ? "border-brand-600 text-brand-600"
          : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
      }`}
    >
      {children}
    </button>
  );
}

export function TabPanel({ id, children }: { id: string; children: ReactNode }) {
  const { active } = useTabsContext();
  if (active !== id) return null;
  return <div>{children}</div>;
}
