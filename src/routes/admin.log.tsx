import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { AdminShell } from "../components/AdminShell";
import { sk } from "../lib/sk";
import { requireAdminFn } from "../server/auth-fns";
import { listKidsFn } from "../server/admin-fns";
import {
  getKidLogStateFn,
  logCompletionFn,
  logScreenTimeFn,
  addAdjustmentFn,
  undoCompletionFn,
  undoScreenTimeFn,
  addIncidentFn,
  undoIncidentFn,
} from "../server/log-fns";
import {
  choreTypes,
  incidentCategories,
  type ChoreType,
  type IncidentCategory,
} from "../server/schema";
import { ErrorBanner } from "../components/ErrorBanner";
import { getErrorMessage } from "../lib/errors";

export const Route = createFileRoute("/admin/log")({
  beforeLoad: () => requireAdminFn(),
  loader: async () => {
    const { kids } = await listKidsFn();
    const active = kids.filter((k) => k.active);
    if (active.length === 0) return { kids: [], state: null };
    const state = await getKidLogStateFn({ data: { kidId: active[0]!.id } });
    return { kids: active, state };
  },
  component: AdminLogPage,
});

const inputCls =
  "w-full px-3 py-2 rounded-card bg-white border border-ink-soft/20 focus:outline-none focus:ring-2 focus:ring-lavender-deep";
const primaryBtn =
  "rounded-card bg-lavender-deep text-white px-5 py-2 font-medium hover:bg-lavender disabled:opacity-50";

function AdminLogPage() {
  const initial = Route.useLoaderData();
  const router = useRouter();
  const [kidId, setKidId] = useState<number | null>(initial.state?.kid.id ?? null);
  const [state, setState] = useState(initial.state);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refreshState(id: number) {
    try {
      const next = await getKidLogStateFn({ data: { kidId: id } });
      setState(next);
    } catch (err) {
      setError(getErrorMessage(err, sk.errors.loadFailed));
    }
  }

  async function selectKid(id: number) {
    setKidId(id);
    await refreshState(id);
  }

  async function onLogChore(choreId: number) {
    if (!kidId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await logCompletionFn({ data: { kidId, choreId } });
      if (res.ok === false) {
        setFlash(res.error === "weekLimitReached" ? sk.admin.log.weekLimitReached : sk.admin.log.limitReached);
      } else {
        setFlash(res.minutesAwarded > 0 ? sk.admin.log.awarded.replace("{n}", String(res.minutesAwarded)) : sk.admin.log.logged);
      }
      await refreshState(kidId);
      router.invalidate();
    } catch (err) {
      setError(getErrorMessage(err, sk.errors.logFailed));
    } finally {
      setBusy(false);
    }
  }

  async function onUndoCompletion(id: number) {
    if (!kidId) return;
    setError(null);
    try {
      await undoCompletionFn({ data: { id } });
      await refreshState(kidId);
      router.invalidate();
    } catch (err) {
      setError(getErrorMessage(err, sk.errors.generic));
    }
  }

  async function onUndoScreen(id: number) {
    if (!kidId) return;
    setError(null);
    try {
      await undoScreenTimeFn({ data: { id } });
      await refreshState(kidId);
      router.invalidate();
    } catch (err) {
      setError(getErrorMessage(err, sk.errors.generic));
    }
  }

  async function onUndoIncident(id: number) {
    if (!kidId) return;
    setError(null);
    try {
      await undoIncidentFn({ data: { id } });
      await refreshState(kidId);
      router.invalidate();
    } catch (err) {
      setError(getErrorMessage(err, sk.errors.generic));
    }
  }

  if (initial.kids.length === 0) {
    return (
      <AdminShell>
        <p className="text-ink-soft">{sk.admin.kids.empty}</p>
      </AdminShell>
    );
  }

  if (!state || !kidId) return <AdminShell>...</AdminShell>;

  return (
    <AdminShell>
      <h1 className="text-2xl font-bold mb-4">{sk.admin.log.heading}</h1>

      {initial.kids.length > 1 && (
        <div className="flex gap-2 mb-4 overflow-x-auto">
          {initial.kids.map((k) => (
            <button
              key={k.id}
              onClick={() => selectKid(k.id)}
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

      <div className="grid grid-cols-3 gap-2 mb-6 text-center">
        <Stat label={sk.admin.today.availableLabel} value={`${state.available}`} unit="min" />
        <Stat label={sk.admin.today.bankLabel} value={`${Math.max(0, state.balance)}`} unit="min" />
        <Stat label={sk.admin.today.usedTodayLabel} value={`${state.usedToday}`} unit="min" />
      </div>

      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      {flash && (
        <div className="bg-mint/40 text-ink rounded-card px-3 py-2 mb-4 text-sm" role="status">
          {flash}
        </div>
      )}

      {/* Chores */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">{sk.admin.log.completedChore}</h2>
        {choreTypes.map((t) => {
          const list = state.chores.filter((c) => c.type === t);
          if (list.length === 0) return null;
          return (
            <div key={t} className="mb-4">
              <h3 className="text-xs uppercase tracking-wide text-ink-soft mb-2">
                {sk.admin.chores.groupHeading[t]}
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {list.map((c) => {
                  const disabled = busy || c.dayCapReached || c.weekCapReached;
                  return (
                    <button
                      key={c.id}
                      onClick={() => onLogChore(c.id)}
                      disabled={disabled}
                      className={
                        "rounded-card p-3 text-left flex items-center gap-2 transition-colors " +
                        (disabled
                          ? "bg-white/30 text-ink-soft cursor-not-allowed"
                          : "bg-white/80 hover:bg-white shadow-sm")
                      }
                    >
                      <span className="text-2xl">{c.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{c.name}</div>
                        <div className="text-xs text-ink-soft">
                          {choreSubtitle(c.type, c.rewardMinutes, c.bonusMin, c.bonusMax, c.todayCount, c.maxPerDay)}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>

      {/* Screen time */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">{sk.admin.log.logScreenTime}</h2>
        {state.unmetRequired.length > 0 && (
          <div className="bg-butter/60 border border-butter-deep/40 rounded-card p-3 mb-3 text-sm">
            <div className="font-semibold mb-1">⚠️ {sk.admin.log.gateWarningTitle}</div>
            <div className="text-ink-soft mb-1.5">{sk.admin.log.gateWarningBody}</div>
            <ul className="space-y-0.5">
              {state.unmetRequired.map((c) => (
                <li key={c.id}>
                  <span className="mr-1.5">{c.icon}</span>
                  {c.name}
                </li>
              ))}
            </ul>
          </div>
        )}
        <LogScreenTimeForm
          onSubmit={async (minutes, note) => {
            setError(null);
            try {
              await logScreenTimeFn({ data: { kidId, minutes, note } });
              await refreshState(kidId);
              router.invalidate();
            } catch (err) {
              setError(getErrorMessage(err, sk.errors.logFailed));
            }
          }}
        />
      </section>

      {/* Behavior incidents (parent-only; no minute impact) */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">{sk.admin.log.logIncident}</h2>
        <IncidentForm
          onSubmit={async (category, note) => {
            setError(null);
            try {
              await addIncidentFn({ data: { kidId, category, note } });
              await refreshState(kidId);
              router.invalidate();
            } catch (err) {
              setError(getErrorMessage(err, sk.errors.logFailed));
            }
          }}
        />
      </section>

      {/* Adjustment */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">{sk.admin.log.adjustBalance}</h2>
        <AdjustmentForm
          onSubmit={async (minutes, reason) => {
            setError(null);
            try {
              await addAdjustmentFn({ data: { kidId, minutes, reason } });
              await refreshState(kidId);
              router.invalidate();
            } catch (err) {
              setError(getErrorMessage(err, sk.errors.logFailed));
            }
          }}
        />
      </section>

      {/* Today's entries */}
      <section>
        <h2 className="text-lg font-semibold mb-3">{sk.admin.log.todayEntries}</h2>
        {state.todayCompletions.length === 0 &&
          state.todayUsage.length === 0 &&
          state.todayAdjustments.length === 0 &&
          state.todayIncidents.length === 0 && (
            <p className="text-ink-soft text-sm">{sk.admin.log.noTodayEntries}</p>
          )}

        <ul className="space-y-1.5 text-sm">
          {state.todayCompletions.map((c) => (
            <li key={`c-${c.id}`} className="flex items-center gap-2 bg-mint/30 rounded-card px-3 py-2">
              <span className="text-lg">{c.choreIcon}</span>
              <span className="flex-1 truncate">{c.choreName}</span>
              {c.minutesAwarded > 0 && (
                <span className="text-mint-deep font-medium">
                  +{c.minutesAwarded} min
                </span>
              )}
              <button onClick={() => onUndoCompletion(c.id)} className="text-xs text-ink-soft hover:underline">
                ↶
              </button>
            </li>
          ))}
          {state.todayUsage.map((u) => (
            <li key={`u-${u.id}`} className="flex items-center gap-2 bg-peach/30 rounded-card px-3 py-2">
              <span className="text-lg">📱</span>
              <span className="flex-1 text-ink-soft truncate">{u.note ?? sk.admin.log.logScreenTime}</span>
              <span className="text-peach-deep font-medium">−{u.minutes} min</span>
              <button onClick={() => onUndoScreen(u.id)} className="text-xs text-ink-soft hover:underline">
                ↶
              </button>
            </li>
          ))}
          {state.todayAdjustments.map((a) => (
            <li key={`a-${a.id}`} className="flex items-center gap-2 bg-lavender/30 rounded-card px-3 py-2">
              <span className="text-lg">✏️</span>
              <span className="flex-1 truncate">{a.reason ?? sk.admin.log.adjustBalance}</span>
              <span className={(a.minutes >= 0 ? "text-mint-deep" : "text-peach-deep") + " font-medium"}>
                {a.minutes >= 0 ? "+" : ""}
                {a.minutes} min
              </span>
            </li>
          ))}
          {state.todayIncidents.map((i) => (
            <li key={`i-${i.id}`} className="flex items-start gap-2 bg-butter/40 rounded-card px-3 py-2">
              <span className="text-lg">📝</span>
              <div className="flex-1 min-w-0">
                <div className="font-medium">{sk.incidents.category[i.category as IncidentCategory]}</div>
                {i.note && <div className="text-xs text-ink-soft truncate">{i.note}</div>}
              </div>
              <button onClick={() => onUndoIncident(i.id)} className="text-xs text-ink-soft hover:underline">
                ↶
              </button>
            </li>
          ))}
        </ul>
      </section>
    </AdminShell>
  );
}

function choreSubtitle(
  type: ChoreType,
  reward: number,
  bonusMin: number | null,
  bonusMax: number | null,
  todayCount: number,
  maxPerDay: number | null,
): string {
  let label: string;
  if (type === "family_duty") label = sk.admin.chores.groupHeading.family_duty;
  else if (type === "earning_weekly_quest" && bonusMin !== null && bonusMax !== null) {
    label = `${bonusMin}–${bonusMax} min`;
  } else label = `${reward} min`;
  if (maxPerDay !== null) label += ` · ${todayCount}/${maxPerDay}`;
  return label;
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="bg-white/70 rounded-card p-3">
      <div className="text-xs text-ink-soft">{label}</div>
      <div className="text-2xl font-bold">
        {value}
        <span className="text-sm font-normal text-ink-soft"> {unit}</span>
      </div>
    </div>
  );
}

function LogScreenTimeForm({ onSubmit }: { onSubmit: (minutes: number, note?: string) => Promise<void> }) {
  const [minutes, setMinutes] = useState(30);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!minutes) return;
        setBusy(true);
        try {
          await onSubmit(minutes, note || undefined);
          setNote("");
        } finally {
          setBusy(false);
        }
      }}
      className="flex flex-wrap gap-2 items-end"
    >
      <label className="block flex-1 min-w-[100px]">
        <span className="block text-sm font-medium mb-1">{sk.admin.log.minutes}</span>
        <input
          type="number"
          min={1}
          max={600}
          value={minutes}
          onChange={(e) => setMinutes(Number(e.target.value))}
          className={inputCls}
          required
        />
      </label>
      <label className="block flex-[2] min-w-[140px]">
        <span className="block text-sm font-medium mb-1">{sk.admin.log.reason}</span>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className={inputCls}
          placeholder={sk.admin.log.reasonPlaceholder}
          maxLength={200}
        />
      </label>
      <button type="submit" disabled={busy} className={primaryBtn}>
        {sk.admin.log.log}
      </button>
    </form>
  );
}

function IncidentForm({
  onSubmit,
}: {
  onSubmit: (category: IncidentCategory, note?: string) => Promise<void>;
}) {
  const [category, setCategory] = useState<IncidentCategory>("homework_missed");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await onSubmit(category, note || undefined);
          setNote("");
        } finally {
          setBusy(false);
        }
      }}
      className="space-y-2"
    >
      <div className="flex flex-wrap gap-1.5">
        {incidentCategories.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={
              "px-3 py-1.5 rounded-card text-sm " +
              (category === c
                ? "bg-butter-deep text-ink font-medium"
                : "bg-white/70 text-ink-soft hover:bg-white")
            }
          >
            {sk.incidents.category[c]}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 items-end">
        <label className="block flex-1 min-w-[180px]">
          <span className="block text-sm font-medium mb-1">{sk.admin.log.incidentNote}</span>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={inputCls}
            placeholder={sk.incidents.notePlaceholder}
            maxLength={500}
          />
        </label>
        <button type="submit" disabled={busy} className={primaryBtn}>
          {sk.admin.log.incidentSave}
        </button>
      </div>
    </form>
  );
}

function AdjustmentForm({ onSubmit }: { onSubmit: (minutes: number, reason?: string) => Promise<void> }) {
  const [minutes, setMinutes] = useState(15);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!minutes) return;
        setBusy(true);
        try {
          await onSubmit(minutes, reason || undefined);
          setReason("");
        } finally {
          setBusy(false);
        }
      }}
      className="flex flex-wrap gap-2 items-end"
    >
      <label className="block flex-1 min-w-[100px]">
        <span className="block text-sm font-medium mb-1">{sk.admin.log.minutes} (+ / −)</span>
        <input
          type="number"
          min={-600}
          max={600}
          value={minutes}
          onChange={(e) => setMinutes(Number(e.target.value))}
          className={inputCls}
          required
        />
      </label>
      <label className="block flex-[2] min-w-[140px]">
        <span className="block text-sm font-medium mb-1">{sk.admin.log.reason}</span>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className={inputCls}
          placeholder={sk.admin.log.reasonPlaceholder}
          maxLength={200}
        />
      </label>
      <button type="submit" disabled={busy || minutes === 0} className={primaryBtn}>
        {sk.admin.log.log}
      </button>
    </form>
  );
}
