import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { AdminShell } from "../components/AdminShell";
import { CalendarGrid } from "../components/CalendarGrid";
import { ErrorBanner } from "../components/ErrorBanner";
import { sk } from "../lib/sk";
import { getErrorMessage } from "../lib/errors";
import { requireAdminFn } from "../server/auth-fns";
import { listKidsFn } from "../server/admin-fns";
import { getKidCalendarFn } from "../server/kid-fns";
import {
  getKidDayDetailsFn,
  undoCompletionFn,
  undoScreenTimeFn,
  undoAdjustmentFn,
  undoIncidentFn,
} from "../server/log-fns";
import type { IncidentCategory } from "../server/schema";

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

type DayDetails = Awaited<ReturnType<typeof getKidDayDetailsFn>>;

function AdminCalendarPage() {
  const initial = Route.useLoaderData();
  const router = useRouter();
  const [kidId, setKidId] = useState<number | null>(initial.cal ? initial.kids[0]!.id : null);
  const [cal, setCal] = useState(initial.cal);
  const [details, setDetails] = useState<DayDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh(id: number, year: number, month: number) {
    try {
      const next = await getKidCalendarFn({ data: { kidId: id, year, month } });
      setCal(next);
    } catch (err) {
      setError(getErrorMessage(err, sk.errors.loadFailed));
    }
  }

  async function openDay(day: string) {
    if (!kidId) return;
    setError(null);
    setDetailsLoading(true);
    try {
      const d = await getKidDayDetailsFn({ data: { kidId, day } });
      setDetails(d);
    } catch (err) {
      setError(getErrorMessage(err, sk.errors.loadFailed));
    } finally {
      setDetailsLoading(false);
    }
  }

  async function refreshDay() {
    if (!kidId || !details) return;
    try {
      const d = await getKidDayDetailsFn({ data: { kidId, day: details.day } });
      setDetails(d);
      // also refresh the calendar so star counts / day colors update
      if (cal) await refresh(kidId, cal.year, cal.month);
      router.invalidate();
    } catch (err) {
      setError(getErrorMessage(err, sk.errors.loadFailed));
    }
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

      <ErrorBanner message={error} onDismiss={() => setError(null)} />

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
        onDayClick={openDay}
      />

      {detailsLoading && !details && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center">
          <div className="bg-cream rounded-card px-4 py-3">…</div>
        </div>
      )}

      {details && (
        <DayDetailsModal
          details={details}
          onClose={() => setDetails(null)}
          onChanged={refreshDay}
          onError={(msg) => setError(msg)}
        />
      )}
    </AdminShell>
  );
}

function DayDetailsModal({
  details,
  onClose,
  onChanged,
  onError,
}: {
  details: DayDetails;
  onClose: () => void;
  onChanged: () => Promise<void>;
  onError: (msg: string) => void;
}) {
  async function wrap(fn: () => Promise<unknown>) {
    try {
      await fn();
      await onChanged();
    } catch (err) {
      onError(getErrorMessage(err, sk.errors.deleteFailed));
    }
  }

  const empty =
    details.completions.length === 0 &&
    details.usage.length === 0 &&
    details.adjustments.length === 0 &&
    details.incidents.length === 0;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/30 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-cream w-full max-w-md rounded-card p-5 shadow-2xl max-h-[90dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{prettyDate(details.day)}</h2>
          <button onClick={onClose} className="text-ink-soft text-sm hover:underline">
            {sk.admin.kids.cancel}
          </button>
        </div>

        {empty && <p className="text-sm text-ink-soft">{sk.admin.log.noTodayEntries}</p>}

        <ul className="space-y-1.5 text-sm">
          {details.completions.map((c) => (
            <li
              key={`c-${c.id}`}
              className="flex items-center gap-2 bg-mint/30 rounded-card px-3 py-2"
            >
              <span className="text-lg">{c.choreIcon}</span>
              <span className="flex-1 truncate">{c.choreName}</span>
              {c.minutesAwarded > 0 && (
                <span className="text-mint-deep font-medium">+{c.minutesAwarded} min</span>
              )}
              <DayDeleteBtn onClick={() => wrap(() => undoCompletionFn({ data: { id: c.id } }))} />
            </li>
          ))}
          {details.usage.map((u) => (
            <li
              key={`u-${u.id}`}
              className="flex items-center gap-2 bg-peach/30 rounded-card px-3 py-2"
            >
              <span className="text-lg">📱</span>
              <span className="flex-1 text-ink-soft truncate">
                {u.note ?? sk.admin.log.logScreenTime}
              </span>
              <span className="text-peach-deep font-medium">−{u.minutes} min</span>
              <DayDeleteBtn onClick={() => wrap(() => undoScreenTimeFn({ data: { id: u.id } }))} />
            </li>
          ))}
          {details.adjustments.map((a) => (
            <li
              key={`a-${a.id}`}
              className="flex items-center gap-2 bg-lavender/30 rounded-card px-3 py-2"
            >
              <span className="text-lg">✏️</span>
              <span className="flex-1 truncate">{a.reason ?? sk.admin.log.adjustBalance}</span>
              <span
                className={
                  (a.minutes >= 0 ? "text-mint-deep" : "text-peach-deep") + " font-medium"
                }
              >
                {a.minutes >= 0 ? "+" : ""}
                {a.minutes} min
              </span>
              <DayDeleteBtn onClick={() => wrap(() => undoAdjustmentFn({ data: { id: a.id } }))} />
            </li>
          ))}
          {details.incidents.map((i) => (
            <li
              key={`i-${i.id}`}
              className="flex items-start gap-2 bg-butter/40 rounded-card px-3 py-2"
            >
              <span className="text-lg">📝</span>
              <div className="flex-1 min-w-0">
                <div className="font-medium">
                  {sk.incidents.category[i.category as IncidentCategory]}
                </div>
                {i.note && <div className="text-xs text-ink-soft truncate">{i.note}</div>}
              </div>
              <DayDeleteBtn onClick={() => wrap(() => undoIncidentFn({ data: { id: i.id } }))} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function DayDeleteBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="vymazať"
      className="shrink-0 rounded-card px-2 py-1 text-sm text-peach-deep hover:bg-peach/50"
    >
      🗑
    </button>
  );
}

function prettyDate(key: string): string {
  // key = "YYYY-MM-DD"
  const [y, m, d] = key.split("-").map(Number);
  if (!y || !m || !d) return key;
  return `${d}. ${sk.calendar.months[m - 1]} ${y}`;
}
