import { createFileRoute, Link } from "@tanstack/react-router";
import { AdminShell } from "../components/AdminShell";
import { sk } from "../lib/sk";
import { requireAdminFn } from "../server/auth-fns";
import { getTodayOverviewFn } from "../server/log-fns";

export const Route = createFileRoute("/admin/")({
  beforeLoad: () => requireAdminFn(),
  loader: () => getTodayOverviewFn(),
  component: AdminHome,
});

function AdminHome() {
  const { kids } = Route.useLoaderData();

  if (kids.length === 0) {
    return (
      <AdminShell>
        <h1 className="text-2xl font-bold mb-4">{sk.admin.today.heading}</h1>
        <p className="text-ink-soft mb-4">{sk.admin.kids.empty}</p>
        <Link
          to="/admin/kids"
          className="inline-block rounded-card bg-lavender-deep text-white px-5 py-2 font-medium"
        >
          + {sk.admin.kids.add}
        </Link>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <h1 className="text-2xl font-bold mb-4">{sk.admin.today.heading}</h1>
      <div className="space-y-4">
        {kids.map((row) => (
          <article key={row.kid.id} className="bg-white/70 rounded-card p-4 shadow-sm">
            <header className="flex items-center gap-3 mb-3">
              <span className="text-3xl">{row.kid.avatarEmoji}</span>
              <h2 className="text-xl font-semibold flex-1">{row.kid.name}</h2>
              <Link
                to="/admin/log"
                className="text-sm bg-lavender-deep text-white rounded-card px-3 py-1.5"
              >
                {sk.admin.log.heading}
              </Link>
            </header>

            <div className="grid grid-cols-3 gap-2 text-center mb-3">
              <Stat label={sk.admin.today.availableLabel} value={row.available} accent="mint" />
              <Stat label={sk.admin.today.bankLabel} value={Math.max(0, row.balance)} accent="lavender" />
              <Stat label={sk.admin.today.usedTodayLabel} value={row.usedToday} accent="peach" />
            </div>

            <div className="text-sm">
              <div className="text-ink-soft mb-1">
                {sk.admin.today.choresDoneLabel}: <strong>{row.choresDoneToday}</strong>
              </div>
              {row.todayCompletions.length > 0 ? (
                <ul className="flex flex-wrap gap-1.5">
                  {row.todayCompletions.map((c) => (
                    <li
                      key={c.id}
                      className="bg-mint/40 rounded-full px-2.5 py-1 text-xs flex items-center gap-1"
                    >
                      <span>{c.choreIcon}</span>
                      <span>{c.choreName}</span>
                      {c.minutesAwarded > 0 && (
                        <span className="text-mint-deep font-medium">+{c.minutesAwarded}</span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-ink-soft text-xs italic">{sk.admin.today.empty}</p>
              )}
            </div>
          </article>
        ))}
      </div>
    </AdminShell>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent: "mint" | "lavender" | "peach" }) {
  const bg = { mint: "bg-mint/40", lavender: "bg-lavender/40", peach: "bg-peach/40" }[accent];
  return (
    <div className={bg + " rounded-card p-2"}>
      <div className="text-[10px] uppercase tracking-wide text-ink-soft">{label}</div>
      <div className="text-2xl font-bold">
        {value}
        <span className="text-xs font-normal text-ink-soft"> min</span>
      </div>
    </div>
  );
}
