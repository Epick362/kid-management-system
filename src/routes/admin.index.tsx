import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "../components/AdminShell";
import { sk } from "../lib/sk";
import { requireAdminFn } from "../server/auth-fns";

export const Route = createFileRoute("/admin/")({
  beforeLoad: () => requireAdminFn(),
  component: AdminHome,
});

function AdminHome() {
  return (
    <AdminShell>
      <h1 className="text-2xl font-bold mb-4">{sk.admin.today.heading}</h1>
      <p className="text-ink-soft">{sk.admin.today.empty}</p>
    </AdminShell>
  );
}
