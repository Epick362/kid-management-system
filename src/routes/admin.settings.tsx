import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { AdminShell } from "../components/AdminShell";
import { sk } from "../lib/sk";
import { requireAdminFn } from "../server/auth-fns";
import {
  getSettingsFn,
  updateSettingsFn,
  changePasswordFn,
} from "../server/admin-fns";
import { ErrorBanner } from "../components/ErrorBanner";
import { NumberInput } from "../components/NumberInput";
import { getErrorMessage } from "../lib/errors";

export const Route = createFileRoute("/admin/settings")({
  beforeLoad: () => requireAdminFn(),
  loader: () => getSettingsFn(),
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

      <section className="border-t border-ink-soft/15 pt-8">
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
    </AdminShell>
  );
}
