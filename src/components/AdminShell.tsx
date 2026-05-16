import { Link, useRouterState } from "@tanstack/react-router";
import { sk } from "../lib/sk";
import { logoutFn } from "../server/auth-fns";
import type { ReactNode } from "react";

interface NavItem {
  label: string;
  to: string;
}

const NAV: NavItem[] = [
  { label: sk.admin.nav.today, to: "/admin" },
  { label: sk.admin.nav.log, to: "/admin/log" },
  { label: sk.admin.nav.chores, to: "/admin/chores" },
  { label: sk.admin.nav.kids, to: "/admin/kids" },
  { label: sk.admin.nav.calendar, to: "/admin/calendar" },
  { label: sk.admin.nav.settings, to: "/admin/settings" },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const { location } = useRouterState();
  const current = location.pathname;

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="bg-lavender/40 border-b border-lavender-deep/20">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <Link to="/admin" className="font-semibold text-ink">
            🛠️ {sk.admin.title}
          </Link>
          <form action={logoutFn.url} method="POST">
            <button
              type="submit"
              className="text-sm text-ink-soft hover:text-ink underline-offset-2 hover:underline"
            >
              {sk.admin.logout}
            </button>
          </form>
        </div>
        <nav className="max-w-3xl mx-auto px-2 pb-2 flex gap-1 overflow-x-auto">
          {NAV.map((item) => {
            const active = item.to === "/admin" ? current === "/admin" : current.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={
                  "px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors " +
                  (active
                    ? "bg-lavender-deep text-white"
                    : "bg-white/60 text-ink hover:bg-white")
                }
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
