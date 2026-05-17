import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { AdminShell } from "../components/AdminShell";
import { sk } from "../lib/sk";
import { requireAdminFn } from "../server/auth-fns";
import { listKidsFn, upsertKidFn, deleteKidFn } from "../server/admin-fns";
import { kidThemes, type KidTheme } from "../server/schema";

export const Route = createFileRoute("/admin/kids")({
  beforeLoad: () => requireAdminFn(),
  loader: () => listKidsFn(),
  component: AdminKidsPage,
});

const inputCls =
  "w-full px-3 py-2 rounded-card bg-white border border-ink-soft/20 focus:outline-none focus:ring-2 focus:ring-lavender-deep";
const primaryBtn =
  "rounded-card bg-lavender-deep text-white px-5 py-2 font-medium hover:bg-lavender disabled:opacity-50";
const ghostBtn = "rounded-card px-3 py-1.5 text-sm hover:bg-white/60";

interface EditingKid {
  id?: number;
  name: string;
  emoji: string;
  color: string;
  theme: KidTheme;
  active: boolean;
}

const COLORS = ["mint", "peach", "lavender", "butter", "sky"];
const EMOJI_SUGGEST = ["🦊", "🐯", "🐰", "🐻", "🐼", "🦁", "🦄", "🐸", "🐱", "🐶"];

function AdminKidsPage() {
  const { kids } = Route.useLoaderData();
  const router = useRouter();
  const [editing, setEditing] = useState<EditingKid | null>(null);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    await upsertKidFn({
      data: {
        id: editing.id,
        name: editing.name,
        emoji: editing.emoji,
        color: editing.color,
        theme: editing.theme,
        active: editing.active,
      },
    });
    setEditing(null);
    router.invalidate();
  }

  async function onDelete(id: number) {
    if (!confirm(sk.admin.kids.confirmDelete)) return;
    await deleteKidFn({ data: { id } });
    router.invalidate();
  }

  return (
    <AdminShell>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{sk.admin.kids.heading}</h1>
        <button
          onClick={() =>
            setEditing({ name: "", emoji: "🙂", color: "mint", theme: "default", active: true })
          }
          className={primaryBtn}
        >
          + {sk.admin.kids.add}
        </button>
      </div>

      {kids.length === 0 && <p className="text-ink-soft">{sk.admin.kids.empty}</p>}

      <ul className="space-y-2">
        {kids.map((k) => (
          <li
            key={k.id}
            className={
              "flex items-center gap-3 px-3 py-2 rounded-card bg-white/70 " +
              (!k.active ? "opacity-50" : "")
            }
          >
            <span className="text-3xl">{k.avatarEmoji}</span>
            <span className="flex-1 font-medium">{k.name}</span>
            <button
              className={ghostBtn}
              onClick={() =>
                setEditing({
                  id: k.id,
                  name: k.name,
                  emoji: k.avatarEmoji,
                  color: k.color,
                  theme: k.theme,
                  active: k.active,
                })
              }
            >
              {sk.admin.kids.edit}
            </button>
            {k.active && (
              <button className={ghostBtn + " text-peach-deep"} onClick={() => onDelete(k.id)}>
                {sk.admin.kids.delete}
              </button>
            )}
          </li>
        ))}
      </ul>

      {editing && (
        <KidForm
          value={editing}
          onChange={setEditing}
          onSave={onSave}
          onCancel={() => setEditing(null)}
        />
      )}
    </AdminShell>
  );
}

function KidForm({
  value,
  onChange,
  onSave,
  onCancel,
}: {
  value: EditingKid;
  onChange: (v: EditingKid) => void;
  onSave: (e: React.FormEvent) => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-end sm:items-center justify-center p-4">
      <form
        onSubmit={onSave}
        className="bg-cream w-full max-w-md rounded-card p-5 space-y-4 shadow-2xl"
      >
        <h2 className="text-lg font-semibold">
          {value.id ? sk.admin.kids.edit : sk.admin.kids.add}
        </h2>

        <label className="block">
          <span className="block text-sm font-medium mb-1">{sk.admin.kids.nameLabel}</span>
          <input
            type="text"
            value={value.name}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
            className={inputCls}
            required
            autoFocus
          />
        </label>

        <label className="block">
          <span className="block text-sm font-medium mb-1">{sk.admin.kids.emojiLabel}</span>
          <div className="flex flex-wrap gap-1 mb-2">
            {EMOJI_SUGGEST.map((emo) => (
              <button
                key={emo}
                type="button"
                onClick={() => onChange({ ...value, emoji: emo })}
                className={
                  "text-2xl p-1.5 rounded-card " +
                  (value.emoji === emo ? "bg-lavender-deep/30" : "hover:bg-white/60")
                }
              >
                {emo}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={value.emoji}
            onChange={(e) => onChange({ ...value, emoji: e.target.value })}
            className={inputCls}
            maxLength={8}
          />
        </label>

        <label className="block">
          <span className="block text-sm font-medium mb-1">{sk.admin.kids.colorLabel}</span>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onChange({ ...value, color: c })}
                className={
                  `bg-${c} rounded-full w-9 h-9 ring-2 ring-offset-2 ring-offset-cream ` +
                  (value.color === c ? "ring-ink" : "ring-transparent")
                }
                aria-label={c}
              />
            ))}
          </div>
        </label>

        <label className="block">
          <span className="block text-sm font-medium mb-1">{sk.admin.kids.themeLabel}</span>
          <select
            value={value.theme}
            onChange={(e) => onChange({ ...value, theme: e.target.value as KidTheme })}
            className={inputCls}
          >
            {kidThemes.map((t) => (
              <option key={t} value={t}>
                {sk.admin.kids.themeOptions[t]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={value.active}
            onChange={(e) => onChange({ ...value, active: e.target.checked })}
          />
          <span>{sk.admin.kids.activeLabel}</span>
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onCancel} className={ghostBtn}>
            {sk.admin.kids.cancel}
          </button>
          <button type="submit" className={primaryBtn}>
            {sk.admin.kids.save}
          </button>
        </div>
      </form>
    </div>
  );
}
