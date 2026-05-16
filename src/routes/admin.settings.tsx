import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "../components/AdminShell";
import { sk } from "../lib/sk";
import { requireAdminFn } from "../server/auth-fns";

export const Route = createFileRoute("/admin/settings")({
  beforeLoad: () => requireAdminFn(),
  component: AdminSettingsPage,
});

function AdminSettingsPage() {
  return (
    <AdminShell>
      <h1 className="text-2xl font-bold mb-4">{sk.admin.nav.settings}</h1>
      <p className="text-ink-soft">TODO</p>
    </AdminShell>
  );
}
