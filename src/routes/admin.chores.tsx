import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { AdminShell } from "../components/AdminShell";
import { sk } from "../lib/sk";
import { requireAdminFn } from "../server/auth-fns";
import { listChoresFn, upsertChoreFn, deleteChoreFn } from "../server/admin-fns";
import { choreTypes, type ChoreType } from "../server/schema";
import { ErrorBanner } from "../components/ErrorBanner";
import { NumberInput } from "../components/NumberInput";
import { getErrorMessage } from "../lib/errors";
import { installTokenArgFromLocation } from "../lib/install-token";

export const Route = createFileRoute("/admin/chores")({
  beforeLoad: ({ location }) => requireAdminFn(installTokenArgFromLocation(location)),
  loader: () => listChoresFn(),
  component: AdminChoresPage,
});

const inputCls =
  "w-full px-3 py-2 rounded-card bg-white border border-ink-soft/20 focus:outline-none focus:ring-2 focus:ring-lavender-deep";
const primaryBtn =
  "rounded-card bg-lavender-deep text-white px-5 py-2 font-medium hover:bg-lavender disabled:opacity-50";
const ghostBtn = "rounded-card px-3 py-1.5 text-sm hover:bg-white/60";

interface EditingChore {
  id?: number;
  name: string;
  icon: string;
  type: ChoreType;
  rewardMinutes: number;
  bonusMin: number | null;
  bonusMax: number | null;
  maxPerDay: number | null;
  maxPerWeek: number | null;
  requiredForPlay: boolean;
  manualMinutes: boolean;
  active: boolean;
}

const blank = (type: ChoreType): EditingChore => ({
  name: "",
  icon: "✨",
  type,
  rewardMinutes: type === "family_duty" ? 0 : type === "earning_weekly_quest" ? 30 : 10,
  bonusMin: null,
  bonusMax: null,
  maxPerDay: type === "earning_daily" ? 1 : null,
  maxPerWeek: type === "earning_weekly_quest" ? 1 : null,
  requiredForPlay: false,
  manualMinutes: false,
  active: true,
});

function AdminChoresPage() {
  const { chores } = Route.useLoaderData();
  const router = useRouter();
  const [editing, setEditing] = useState<EditingChore | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);

  const grouped: Record<ChoreType, typeof chores> = {
    family_duty: [],
    earning_daily: [],
    earning_weekly_quest: [],
  };
  for (const c of chores) grouped[c.type].push(c);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setFormError(null);
    try {
      await upsertChoreFn({ data: editing });
      setEditing(null);
      router.invalidate();
    } catch (err) {
      setFormError(getErrorMessage(err, sk.errors.saveFailed));
    }
  }

  async function onDelete(id: number) {
    if (!confirm(sk.admin.chores.confirmDelete)) return;
    setPageError(null);
    try {
      await deleteChoreFn({ data: { id } });
      router.invalidate();
    } catch (err) {
      setPageError(getErrorMessage(err, sk.errors.deleteFailed));
    }
  }

  return (
    <AdminShell>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{sk.admin.chores.heading}</h1>
        <button onClick={() => setEditing(blank("earning_daily"))} className={primaryBtn}>
          + {sk.admin.chores.add}
        </button>
      </div>

      <ErrorBanner message={pageError} onDismiss={() => setPageError(null)} />

      {chores.length === 0 && <p className="text-ink-soft">{sk.admin.chores.empty}</p>}

      {choreTypes.map((t) => {
        const list = grouped[t];
        if (list.length === 0) return null;
        return (
          <section key={t} className="mb-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-soft mb-2">
              {sk.admin.chores.groupHeading[t]}
            </h2>
            <ul className="space-y-2">
              {list.map((c) => (
                <li
                  key={c.id}
                  className={
                    "flex items-center gap-3 px-3 py-2 rounded-card bg-white/70 " +
                    (!c.active ? "opacity-50" : "")
                  }
                >
                  <span className="text-2xl">{c.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{c.name}</div>
                    <div className="text-xs text-ink-soft">
                      {choreLabel(c.type, c.rewardMinutes, c.manualMinutes)}
                    </div>
                  </div>
                  <button
                    className={ghostBtn}
                    onClick={() =>
                      setEditing({
                        id: c.id,
                        name: c.name,
                        icon: c.icon,
                        type: c.type,
                        rewardMinutes: c.rewardMinutes,
                        bonusMin: c.bonusMin,
                        bonusMax: c.bonusMax,
                        maxPerDay: c.maxPerDay,
                        maxPerWeek: c.maxPerWeek,
                        requiredForPlay: c.requiredForPlay,
                        manualMinutes: c.manualMinutes,
                        active: c.active,
                      })
                    }
                  >
                    {sk.admin.chores.edit}
                  </button>
                  {c.active && (
                    <button
                      className={ghostBtn + " text-peach-deep"}
                      onClick={() => onDelete(c.id)}
                    >
                      {sk.admin.chores.delete}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {editing && (
        <ChoreForm
          value={editing}
          onChange={setEditing}
          onSave={onSave}
          onCancel={() => {
            setEditing(null);
            setFormError(null);
          }}
          error={formError}
          onDismissError={() => setFormError(null)}
        />
      )}
    </AdminShell>
  );
}

function choreLabel(type: ChoreType, reward: number, manualMinutes: boolean): string {
  if (type === "family_duty") return sk.admin.chores.groupHeading.family_duty;
  if (manualMinutes) return sk.admin.chores.manualMinutesShort;
  return `${reward} min`;
}

function ChoreForm({
  value,
  onChange,
  onSave,
  onCancel,
  error,
  onDismissError,
}: {
  value: EditingChore;
  onChange: (v: EditingChore) => void;
  onSave: (e: React.FormEvent) => void;
  onCancel: () => void;
  error: string | null;
  onDismissError: () => void;
}) {
  const isWeekly = value.type === "earning_weekly_quest";
  const isDaily = value.type === "earning_daily";
  const isFamily = value.type === "family_duty";

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-end sm:items-center justify-center p-4 overflow-y-auto">
      <form
        onSubmit={onSave}
        className="bg-cream w-full max-w-md rounded-card p-5 space-y-3 shadow-2xl max-h-[90dvh] overflow-y-auto"
      >
        <h2 className="text-lg font-semibold">
          {value.id ? sk.admin.chores.edit : sk.admin.chores.add}
        </h2>
        <ErrorBanner message={error} onDismiss={onDismissError} />

        <Field label={sk.admin.chores.nameLabel}>
          <input
            type="text"
            value={value.name}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
            className={inputCls}
            required
            autoFocus
          />
        </Field>

        <Field label={sk.admin.chores.iconLabel}>
          <input
            type="text"
            value={value.icon}
            onChange={(e) => onChange({ ...value, icon: e.target.value })}
            className={inputCls}
            maxLength={8}
          />
        </Field>

        <Field label={sk.admin.chores.typeLabel}>
          <select
            value={value.type}
            onChange={(e) => {
              const t = e.target.value as ChoreType;
              // Switching type resets reward fields to sensible defaults
              onChange({ ...blank(t), id: value.id, name: value.name, icon: value.icon, active: value.active });
            }}
            className={inputCls}
          >
            {choreTypes.map((t) => (
              <option key={t} value={t}>
                {sk.admin.chores.groupHeading[t]}
              </option>
            ))}
          </select>
        </Field>

        {!isFamily && (
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={value.manualMinutes}
              onChange={(e) => onChange({ ...value, manualMinutes: e.target.checked })}
              className="mt-1"
            />
            <span>
              <span className="block">{sk.admin.chores.manualMinutesLabel}</span>
              <span className="block text-xs text-ink-soft">
                {sk.admin.chores.manualMinutesHint}
              </span>
            </span>
          </label>
        )}

        {!isFamily && !value.manualMinutes && (
          <Field label={sk.admin.chores.rewardLabel}>
            <NumberInput
              min={0}
              max={600}
              value={value.rewardMinutes}
              onChange={(n) => onChange({ ...value, rewardMinutes: n })}
              className={inputCls}
              required
            />
          </Field>
        )}

        {isDaily && (
          <Field label={sk.admin.chores.maxPerDayLabel}>
            <NumberInput
              min={1}
              max={20}
              value={value.maxPerDay ?? 1}
              onChange={(n) => onChange({ ...value, maxPerDay: n })}
              className={inputCls}
            />
          </Field>
        )}

        {isWeekly && (
          <Field label={sk.admin.chores.maxPerWeekLabel}>
            <NumberInput
              min={1}
              max={50}
              value={value.maxPerWeek ?? 1}
              onChange={(n) => onChange({ ...value, maxPerWeek: n })}
              className={inputCls}
            />
          </Field>
        )}

        {isFamily && (
          <Field label={sk.admin.chores.maxPerDayLabel}>
            <NumberInput
              min={1}
              max={20}
              value={value.maxPerDay ?? 1}
              onChange={(n) => onChange({ ...value, maxPerDay: n })}
              className={inputCls}
            />
          </Field>
        )}

        {isFamily && (
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={value.requiredForPlay}
              onChange={(e) => onChange({ ...value, requiredForPlay: e.target.checked })}
              className="mt-1"
            />
            <span>
              <span className="block">{sk.admin.chores.requiredForPlayLabel}</span>
              <span className="block text-xs text-ink-soft">
                {sk.admin.chores.requiredForPlayHint}
              </span>
            </span>
          </label>
        )}

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={value.active}
            onChange={(e) => onChange({ ...value, active: e.target.checked })}
          />
          <span>{sk.admin.chores.activeLabel}</span>
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onCancel} className={ghostBtn}>
            {sk.admin.chores.cancel}
          </button>
          <button type="submit" className={primaryBtn}>
            {sk.admin.chores.save}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium mb-1">{label}</span>
      {children}
    </label>
  );
}
