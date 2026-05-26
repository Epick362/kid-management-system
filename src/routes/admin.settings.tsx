import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { AdminShell } from "../components/AdminShell";
import { sk } from "../lib/sk";
import { requireAdminFn } from "../server/auth-fns";
import {
  getSettingsFn,
  updateSettingsFn,
  changePasswordFn,
  listInstallTokensFn,
  createInstallTokenFn,
  deleteInstallTokenFn,
} from "../server/admin-fns";
import { ErrorBanner } from "../components/ErrorBanner";
import { NumberInput } from "../components/NumberInput";
import { getErrorMessage } from "../lib/errors";
import { installTokenArgFromLocation } from "../lib/install-token";

export const Route = createFileRoute("/admin/settings")({
  beforeLoad: ({ location }) => requireAdminFn(installTokenArgFromLocation(location)),
  loader: async () => {
    const [settings, tokens] = await Promise.all([getSettingsFn(), listInstallTokensFn()]);
    return { ...settings, installTokens: tokens.tokens };
  },
  component: AdminSettingsPage,
});

const inputCls =
  "w-full px-3 py-2 rounded-card bg-white border border-ink-soft/20 focus:outline-none focus:ring-2 focus:ring-lavender-deep";
const primaryBtn =
  "rounded-card bg-lavender-deep text-white px-5 py-2 font-medium hover:bg-lavender disabled:opacity-50";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-ink mb-1">{label}</span>
      {children}
    </label>
  );
}

function AdminSettingsPage() {
  const initial = Route.useLoaderData();
  const router = useRouter();

  const [name, setName] = useState(initial.name);
  const [dailyCap, setDailyCap] = useState(initial.dailyCapMinutes);
  const [bankCap, setBankCap] = useState(initial.bankCapMinutes);
  const [defaultChore, setDefaultChore] = useState(initial.defaultChoreMinutes);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const [newPassword, setNewPassword] = useState("");
  const [pwSavedAt, setPwSavedAt] = useState<number | null>(null);

  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);

  async function onSubmitSettings(e: React.FormEvent) {
    e.preventDefault();
    setSettingsError(null);
    try {
      await updateSettingsFn({
        data: {
          name,
          dailyCapMinutes: Number(dailyCap),
          bankCapMinutes: Number(bankCap),
          defaultChoreMinutes: Number(defaultChore),
        },
      });
      setSavedAt(Date.now());
      router.invalidate();
    } catch (err) {
      setSettingsError(getErrorMessage(err, sk.errors.saveFailed));
    }
  }

  async function onChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 4) return;
    setPwError(null);
    try {
      await changePasswordFn({ data: { password: newPassword } });
      setNewPassword("");
      setPwSavedAt(Date.now());
    } catch (err) {
      setPwError(getErrorMessage(err, sk.errors.saveFailed));
    }
  }

  return (
    <AdminShell>
      <h1 className="text-2xl font-bold mb-6">{sk.admin.settings.heading}</h1>

      <form onSubmit={onSubmitSettings} className="space-y-4 mb-10">
        <ErrorBanner message={settingsError} onDismiss={() => setSettingsError(null)} />
        <Field label={sk.admin.settings.familyName}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputCls}
            required
          />
        </Field>
        <Field label={sk.admin.settings.dailyCap}>
          <NumberInput
            min={0}
            max={1440}
            value={dailyCap}
            onChange={setDailyCap}
            className={inputCls}
            required
          />
        </Field>
        <Field label={sk.admin.settings.bankCap}>
          <NumberInput
            min={0}
            max={10_000}
            value={bankCap}
            onChange={setBankCap}
            className={inputCls}
            required
          />
        </Field>
        <Field label={sk.admin.settings.defaultChoreMinutes}>
          <NumberInput
            min={0}
            max={600}
            value={defaultChore}
            onChange={setDefaultChore}
            className={inputCls}
            required
          />
        </Field>
        <div className="flex items-center gap-3">
          <button type="submit" className={primaryBtn}>
            {sk.admin.settings.save}
          </button>
          {savedAt && (
            <span key={savedAt} className="text-sm text-mint-deep">
              {sk.admin.settings.saved}
            </span>
          )}
        </div>
      </form>

      <section className="border-t border-ink-soft/15 pt-8 mb-10">
        <h2 className="text-lg font-semibold mb-3">{sk.admin.settings.changePassword}</h2>
        <form onSubmit={onChangePassword} className="space-y-3 max-w-sm">
          <ErrorBanner message={pwError} onDismiss={() => setPwError(null)} />
          <Field label={sk.admin.settings.newPassword}>
            <input
              type="password"
              minLength={4}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={inputCls}
            />
          </Field>
          <div className="flex items-center gap-3">
            <button type="submit" className={primaryBtn} disabled={newPassword.length < 4}>
              {sk.admin.settings.changePassword}
            </button>
            {pwSavedAt && (
              <span key={pwSavedAt} className="text-sm text-mint-deep">
                {sk.admin.settings.passwordChanged}
              </span>
            )}
          </div>
        </form>
      </section>

      <section className="border-t border-ink-soft/15 pt-8">
        <h2 className="text-lg font-semibold mb-2">{sk.admin.settings.installHeading}</h2>
        <p className="text-sm text-ink-soft mb-2">{sk.admin.settings.installHelp}</p>
        <p className="text-xs text-peach-deep mb-4">{sk.admin.settings.installWarning}</p>
        <InstallTokensSection tokens={initial.installTokens} />
      </section>
    </AdminShell>
  );
}

function InstallTokensSection({
  tokens,
}: {
  tokens: { id: string; label: string | null; createdAt: Date; lastUsedAt: Date | null }[];
}) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function urlFor(id: string): string {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/admin?install=${id}`;
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    setError(null);
    setBusy(true);
    try {
      await createInstallTokenFn({ data: { label: label.trim() } });
      setLabel("");
      router.invalidate();
    } catch (err) {
      setError(getErrorMessage(err, sk.errors.saveFailed));
    } finally {
      setBusy(false);
    }
  }

  async function onRevoke(id: string) {
    if (!confirm(sk.admin.settings.installConfirmRevoke)) return;
    setError(null);
    try {
      await deleteInstallTokenFn({ data: { id } });
      router.invalidate();
    } catch (err) {
      setError(getErrorMessage(err, sk.errors.deleteFailed));
    }
  }

  async function onCopy(id: string) {
    try {
      await navigator.clipboard.writeText(urlFor(id));
      setCopiedId(id);
      setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 1500);
    } catch {
      // ignore clipboard failures (older iOS, denied permission, etc.)
    }
  }

  return (
    <>
      <ErrorBanner message={error} onDismiss={() => setError(null)} />
      <form onSubmit={onCreate} className="flex flex-wrap gap-2 items-end mb-4">
        <label className="block flex-1 min-w-[160px]">
          <span className="block text-sm font-medium mb-1">Štítok</span>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className={inputCls}
            maxLength={60}
            placeholder={sk.admin.settings.installLabelPlaceholder}
          />
        </label>
        <button type="submit" disabled={busy || !label.trim()} className={primaryBtn}>
          {sk.admin.settings.installCreate}
        </button>
      </form>

      {tokens.length === 0 ? (
        <p className="text-sm text-ink-soft">{sk.admin.settings.installNone}</p>
      ) : (
        <ul className="space-y-2">
          {tokens.map((t) => (
            <li
              key={t.id}
              className="bg-white/70 rounded-card p-3 flex flex-wrap items-center gap-2"
            >
              <div className="flex-1 min-w-[140px]">
                <div className="font-medium truncate">{t.label ?? "—"}</div>
                <div className="text-xs text-ink-soft">
                  {t.lastUsedAt
                    ? sk.admin.settings.installLastUsed +
                      new Date(t.lastUsedAt).toLocaleString("sk-SK")
                    : sk.admin.settings.installNever}
                </div>
                <div className="text-[11px] text-ink-soft/70 font-mono break-all mt-1">
                  {urlFor(t.id)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onCopy(t.id)}
                className="rounded-card bg-lavender-deep text-white text-sm px-3 py-1.5"
              >
                {copiedId === t.id
                  ? sk.admin.settings.installCopied
                  : sk.admin.settings.installCopy}
              </button>
              <button
                type="button"
                onClick={() => onRevoke(t.id)}
                className="rounded-card text-peach-deep text-sm px-3 py-1.5 hover:bg-peach/40"
              >
                {sk.admin.settings.installRevoke}
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
