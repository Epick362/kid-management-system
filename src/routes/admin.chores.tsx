import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { AdminShell } from "../components/AdminShell";
import { sk } from "../lib/sk";
import { requireAdminFn } from "../server/auth-fns";
import { listChoresFn, upsertChoreFn, deleteChoreFn } from "../server/admin-fns";
import { choreTypes, type ChoreType } from "../server/schema";

export const Route = createFileRoute("/admin/chores")({
  beforeLoad: () => requireAdminFn(),
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
  active: boolean;
}

const blank = (type: ChoreType): EditingChore => ({
  name: "",
  icon: "✨",
  type,
  rewardMinutes: type === "family_duty" ? 0 : 10,
  bonusMin: type === "earning_weekly_quest" ? 15 : null,
  bonusMax: type === "earning_weekly_quest" ? 30 : null,
  maxPerDay: type === "earning_daily" ? 1 : null,
  maxPerWeek: type === "earning_weekly_quest" ? 1 : null,
  active: true,
});

function AdminChoresPage() {
  const { chores } = Route.useLoaderData();
  const router = useRouter();
  const [editing, setEditing] = useState<EditingChore | null>(null);

  const grouped: Record<ChoreType, typeof chores> = {
    family_duty: [],
    earning_daily: [],
    earning_weekly_quest: [],
  };
  for (const c of chores) grouped[c.type].push(c);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    await upsertChoreFn({ data: editing });
    setEditing(null);
    router.invalidate();
  }

  async function onDelete(id: number) {
    if (!confirm(sk.admin.chores.confirmDelete)) return;
    await deleteChoreFn({ data: { id } });
    router.invalidate();
  }

  return (
    <AdminShell>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{sk.admin.chores.heading}</h1>
        <button onClick={() => setEditing(blank("earning_daily"))} className={primaryBtn}>
          + {sk.admin.chores.add}
        </button>
      </div>

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
                      {choreLabel(c.type, c.rewardMinutes, c.bonusMin, c.bonusMax)}
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
          onCancel={() => setEditing(null)}
        />
      )}
    </AdminShell>
  );
}

function choreLabel(
  type: ChoreType,
  reward: number,
  bonusMin: number | null,
  bonusMax: number | null,
): string {
  if (type === "family_duty") return sk.admin.chores.groupHeading.family_duty;
  if (type === "earning_weekly_quest" && bonusMin !== null && bonusMax !== null) {
    return `${bonusMin}–${bonusMax} min`;
  }
  return `${reward} min`;
}

function ChoreForm({
  value,
  onChange,
  onSave,
  onCancel,
}: {
  value: EditingChore;
  onChange: (v: EditingChore) => void;
  onSave: (e: React.FormEvent) => void;
  onCancel: () => void;
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

        {!isFamily && !isWeekly && (
          <Field label={sk.admin.chores.rewardLabel}>
            <input
              type="number"
              min={0}
              max={600}
              value={value.rewardMinutes}
              onChange={(e) =>
                onChange({ ...value, rewardMinutes: Number(e.target.value) })
              }
              className={inputCls}
              required
            />
          </Field>
        )}

        {isWeekly && (
          <div className="grid grid-cols-2 gap-3">
            <Field label={sk.admin.chores.bonusMinLabel}>
              <input
                type="number"
                min={0}
                max={600}
                value={value.bonusMin ?? 0}
                onChange={(e) => onChange({ ...value, bonusMin: Number(e.target.value) })}
                className={inputCls}
                required
              />
            </Field>
            <Field label={sk.admin.chores.bonusMaxLabel}>
              <input
                type="number"
                min={0}
                max={600}
                value={value.bonusMax ?? 0}
                onChange={(e) => onChange({ ...value, bonusMax: Number(e.target.value) })}
                className={inputCls}
                required
              />
            </Field>
          </div>
        )}

        {isDaily && (
          <Field label={sk.admin.chores.maxPerDayLabel}>
            <input
              type="number"
              min={1}
              max={20}
              value={value.maxPerDay ?? 1}
              onChange={(e) => onChange({ ...value, maxPerDay: Number(e.target.value) })}
              className={inputCls}
            />
          </Field>
        )}

        {isWeekly && (
          <Field label={sk.admin.chores.maxPerWeekLabel}>
            <input
              type="number"
              min={1}
              max={50}
              value={value.maxPerWeek ?? 1}
              onChange={(e) => onChange({ ...value, maxPerWeek: Number(e.target.value) })}
              className={inputCls}
            />
          </Field>
        )}

        {isFamily && (
          <Field label={sk.admin.chores.maxPerDayLabel}>
            <input
              type="number"
              min={1}
              max={20}
              value={value.maxPerDay ?? 1}
              onChange={(e) => onChange({ ...value, maxPerDay: Number(e.target.value) })}
              className={inputCls}
            />
          </Field>
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
