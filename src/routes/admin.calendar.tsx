import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { AdminShell } from "../components/AdminShell";
import { CalendarGrid } from "../components/CalendarGrid";
import { sk } from "../lib/sk";
import { requireAdminFn } from "../server/auth-fns";
import { listKidsFn } from "../server/admin-fns";
import { getKidCalendarFn } from "../server/kid-fns";

export const Route = createFileRoute("/admin/calendar")({
  beforeLoad: () => requireAdminFn(),
  loader: async () => {
    const { kids } = await listKidsFn();
    const active = kids.filter((k) => k.active);
    if (active.length === 0) return { kids: [], cal: null };
    const now = new Date();
    const cal = await getKidCalendarFn({
      data: { kidId: active[0]!.id, year: now.getFullYear(), month: now.getMonth() + 1 },
    });
    return { kids: active, cal };
  },
  component: AdminCalendarPage,
});

function AdminCalendarPage() {
  const initial = Route.useLoaderData();
  const router = useRouter();
  const [kidId, setKidId] = useState<number | null>(initial.cal ? initial.kids[0]!.id : null);
  const [cal, setCal] = useState(initial.cal);

  async function refresh(id: number, year: number, month: number) {
    const next = await getKidCalendarFn({ data: { kidId: id, year, month } });
    setCal(next);
  }

  if (!cal || !kidId) {
    return (
      <AdminShell>
        <h1 className="text-2xl font-bold mb-4">{sk.admin.nav.calendar}</h1>
        <p className="text-ink-soft">{sk.admin.kids.empty}</p>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <h1 className="text-2xl font-bold mb-4">{sk.admin.nav.calendar}</h1>

      {initial.kids.length > 1 && (
        <div className="flex gap-2 mb-4 overflow-x-auto">
          {initial.kids.map((k) => (
            <button
              key={k.id}
              onClick={async () => {
                setKidId(k.id);
                await refresh(k.id, cal.year, cal.month);
              }}
              className={
                "px-4 py-2 rounded-card flex items-center gap-2 whitespace-nowrap " +
                (k.id === kidId ? "bg-lavender-deep text-white" : "bg-white/70")
              }
            >
              <span className="text-xl">{k.avatarEmoji}</span>
              {k.name}
            </button>
          ))}
        </div>
      )}

      <CalendarGrid
        year={cal.year}
        month={cal.month}
        days={cal.days}
        onNavigate={(y, m) => {
          if (kidId) refresh(kidId, y, m);
          router.invalidate();
        }}
      />
    </AdminShell>
  );
}
