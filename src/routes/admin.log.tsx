import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "../components/AdminShell";
import { sk } from "../lib/sk";
import { requireAdminFn } from "../server/auth-fns";

export const Route = createFileRoute("/admin/log")({
  beforeLoad: () => requireAdminFn(),
  component: AdminLogPage,
});

function AdminLogPage() {
  return (
    <AdminShell>
      <h1 className="text-2xl font-bold mb-4">{sk.admin.nav.log}</h1>
      <p className="text-ink-soft">TODO</p>
    </AdminShell>
  );
}
