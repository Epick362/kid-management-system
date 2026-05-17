import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { sk } from "../lib/sk";
import { getKidCalendarFn, getKidDashboardFn, kidLogCompletionFn } from "../server/kid-fns";
import { choreTypes, type ChoreType } from "../server/schema";
import { CalendarGrid } from "../components/CalendarGrid";
import { getErrorMessage } from "../lib/errors";

export const Route = createFileRoute("/kid/$kidId")({
  loader: async ({ params }) => {
    const kidId = Number(params.kidId);
    const now = new Date();
    const [dash, cal] = await Promise.all([
      getKidDashboardFn({ data: { kidId } }),
      getKidCalendarFn({ data: { kidId, year: now.getFullYear(), month: now.getMonth() + 1 } }),
    ]);
    return { ...dash, cal };
  },
  component: KidDashboard,
});

function pickPraise(): string {
  const list = sk.chore.praise;
  return list[Math.floor(Math.random() * list.length)]!;
}

function KidDashboard() {
  const initial = Route.useLoaderData();
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [celebrate, setCelebrate] = useState<{ msg: string; minutes: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      const next = await getKidDashboardFn({ data: { kidId: data.kid.id } });
      setData((prev) => ({ ...next, cal: prev.cal }));
    } catch (err) {
      setError(getErrorMessage(err, sk.errors.loadFailed));
    }
  }

  async function onTapChore(choreId: number) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await kidLogCompletionFn({ data: { kidId: data.kid.id, choreId } });
      if (result.ok === false) return;
      setCelebrate({ msg: pickPraise(), minutes: result.minutesAwarded });
      setTimeout(() => setCelebrate(null), 2200);
      await refresh();
      router.invalidate();
    } catch (err) {
      setError(getErrorMessage(err, sk.errors.logFailed));
      setTimeout(() => setError(null), 3500);
    } finally {
      setBusy(false);
    }
  }

  const locked = data.unmetRequired.length > 0;

  return (
    <main className={`kid-root theme-${data.kid.theme} min-h-dvh px-4 py-5 max-w-md mx-auto`}>
      <header className="flex items-center gap-3 mb-4">
        <Link to="/" className="text-2xl">⬅️</Link>
        <span className="text-4xl">{data.kid.avatarEmoji}</span>
        <h1 className="kid-title text-2xl font-bold flex-1">{data.kid.name}</h1>
      </header>

      {locked && (
        <div className="kid-gate mb-4 rounded-card p-4 bg-butter/70 border-2 border-butter-deep/50">
          <div className="flex items-center gap-2 font-bold text-lg mb-1">
            <span>🔒</span>
            <span>{sk.kid.gateTitle}</span>
          </div>
          <div className="text-sm text-ink-soft mb-2">{sk.kid.gateHelp}</div>
          <ul className="space-y-1">
            {data.unmetRequired.map((c) => (
              <li key={c.id} className="flex items-center gap-2 text-base">
                <span className="text-2xl">{c.icon}</span>
                <span className="font-medium">{c.name}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <BalanceRing
        available={data.available}
        dailyCap={data.family.dailyCapMinutes}
        usedToday={data.usedToday}
        locked={locked}
      />

      <div className="grid grid-cols-2 gap-2 mb-6 text-center">
        <div className="kid-stat-bank rounded-card p-2.5">
          <div className="text-xs text-ink-soft">{sk.kid.bankLabel}</div>
          <div className={"text-xl font-bold " + (data.balance < 0 ? "text-peach-deep" : "")}>
            {data.balance}
            <span className="text-sm font-normal text-ink-soft"> {sk.units.min}</span>
          </div>
        </div>
        <div className="kid-stat-used rounded-card p-2.5">
          <div className="text-xs text-ink-soft">{sk.admin.today.usedTodayLabel}</div>
          <div className="text-xl font-bold">
            {data.usedToday}
            <span className="text-sm font-normal text-ink-soft"> {sk.units.min}</span>
          </div>
        </div>
      </div>

      <h2 className="text-xl font-bold mb-3">{sk.kid.pickChore}</h2>
      {data.chores.length === 0 && <p className="text-ink-soft">{sk.kid.noChores}</p>}

      <div className="space-y-5">
        {choreTypes.map((t) => {
          const list = data.chores.filter((c) => c.type === t);
          if (list.length === 0) return null;
          return (
            <section key={t}>
              <h3 className="text-sm uppercase tracking-wide text-ink-soft mb-2">
                {sk.admin.chores.groupHeading[t]}
              </h3>
              <div className="space-y-2">
                {list.map((c) => {
                  const disabled = busy || c.dayCapReached || c.weekCapReached;
                  const required = c.requiredForPlay && c.type === "family_duty" && c.todayCount === 0;
                  return (
                    <button
                      key={c.id}
                      onClick={() => onTapChore(c.id)}
                      disabled={disabled}
                      className={
                        "kid-chore w-full rounded-card p-4 text-left flex items-center gap-3 shadow-sm transition-all " +
                        (disabled
                          ? "bg-white/30 text-ink-soft"
                          : required
                            ? "bg-butter border-2 border-butter-deep hover:scale-[1.02] active:scale-[0.98]"
                            : "bg-white hover:scale-[1.02] active:scale-[0.98]")
                      }
                    >
                      <span className="text-4xl">{c.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-lg truncate">{c.name}</div>
                        <div className="text-sm text-ink-soft">
                          {required && <span className="mr-1.5">🔒</span>}
                          {choreReward(c.type, c.rewardMinutes, c.todayCount, c.maxPerDay)}
                        </div>
                      </div>
                      {!disabled && c.type !== "family_duty" && (
                        <span className="text-lg">▶️</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <section className="mt-8 pt-6 border-t border-ink-soft/15">
        <CalendarGrid
          year={data.cal.year}
          month={data.cal.month}
          days={data.cal.days}
          onNavigate={async (y, m) => {
            const next = await getKidCalendarFn({
              data: { kidId: data.kid.id, year: y, month: m },
            });
            setData((prev) => ({ ...prev, cal: next }));
          }}
        />
      </section>

      {celebrate && <CelebrateOverlay msg={celebrate.msg} minutes={celebrate.minutes} />}
      {error && <ErrorToast msg={error} onDismiss={() => setError(null)} />}
    </main>
  );
}

function ErrorToast({ msg, onDismiss }: { msg: string; onDismiss: () => void }) {
  return (
    <div
      role="alert"
      onClick={onDismiss}
      className="fixed bottom-4 inset-x-4 z-50 max-w-md mx-auto bg-peach-deep text-white rounded-card px-4 py-3 shadow-2xl text-sm flex items-start gap-2"
    >
      <span aria-hidden>⚠️</span>
      <div className="flex-1 break-words">{msg}</div>
      <span className="text-white/80 text-xs">✕</span>
    </div>
  );
}

function choreReward(
  type: ChoreType,
  reward: number,
  todayCount: number,
  maxPerDay: number | null,
): string {
  let label = type === "family_duty" ? "—" : `+${reward} ${sk.units.min}`;
  if (maxPerDay !== null && maxPerDay > 1) label += ` · ${todayCount}/${maxPerDay}`;
  return label;
}

function BalanceRing({
  available,
  dailyCap,
  usedToday,
  locked,
}: {
  available: number;
  dailyCap: number;
  usedToday: number;
  locked: boolean;
}) {
  // Ring fills as the kid uses time today (used / dailyCap).
  const pct = Math.min(100, dailyCap > 0 ? (usedToday / dailyCap) * 100 : 0);
  const dash = (pct / 100) * 251.3; // 2π * r=40
  const hasFill = pct > 0;
  return (
    <div className={"kid-ring flex flex-col items-center mb-6 " + (locked ? "kid-ring-locked" : "")}>
      <div className="relative w-44 h-44">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          {/* outer dark edge (Minecraft XP-bar inset look) */}
          <circle cx="50" cy="50" r="42" stroke="currentColor" strokeWidth="2" fill="none" className="kid-ring-edge" />
          {/* track */}
          <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="8" fill="none" className="kid-ring-track" />
          {/* fill — only when there's progress, butt cap for clean pixel edges */}
          {hasFill && (
            <circle
              cx="50"
              cy="50"
              r="40"
              stroke="currentColor"
              strokeWidth="8"
              fill="none"
              className="kid-ring-fill transition-all duration-500"
              strokeDasharray={`${dash} 251.3`}
              strokeLinecap="butt"
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
          {locked ? (
            <>
              <div className="text-4xl">🔒</div>
              <div className="kid-ring-label mt-1">{sk.kid.locked}</div>
            </>
          ) : (
            <>
              <div className="kid-ring-label">{sk.kid.todayLabel}</div>
              <div className="kid-ring-number leading-none">{available}</div>
              <div className="kid-ring-label">{sk.kid.minutes}</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function CelebrateOverlay({ msg, minutes }: { msg: string; minutes: number }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 pointer-events-none">
      <div className="bg-cream rounded-card p-8 text-center shadow-2xl animate-[pop_300ms_ease-out]">
        <div className="text-6xl mb-2">🎉</div>
        <div className="text-2xl font-bold">{msg}</div>
        {minutes > 0 && (
          <div className="text-mint-deep font-semibold text-xl mt-2">+{minutes} {sk.units.min}</div>
        )}
      </div>
      <style>{`@keyframes pop { 0%{transform:scale(.7);opacity:0} 50%{transform:scale(1.1)} 100%{transform:scale(1);opacity:1} }`}</style>
    </div>
  );
}
