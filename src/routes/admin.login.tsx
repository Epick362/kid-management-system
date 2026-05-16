import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { sk } from "../lib/sk";
import { getFirstRunStateFn, loginFn } from "../server/auth-fns";

export const Route = createFileRoute("/admin/login")({
  loader: () => getFirstRunStateFn(),
  component: AdminLogin,
});

function AdminLogin() {
  const { firstRun, familyName } = Route.useLoaderData();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await loginFn({ data: { password } });
      if (result && "ok" in result && result.ok === false) {
        setError(sk.admin.wrongPassword);
      } else {
        // Server fn threw redirect; router will have navigated already.
        router.invalidate();
      }
    } catch (err) {
      // redirect() throws — that's the success path.
      // Any other error: show generic message.
      const message = err instanceof Error ? err.message : String(err);
      if (!message.toLowerCase().includes("redirect")) {
        setError(message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-dvh flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <header className="text-center space-y-1">
          <p className="text-sm text-ink-soft">{familyName}</p>
          <h1 className="text-2xl font-bold text-ink">
            {firstRun ? sk.admin.firstRunTitle : sk.admin.loginTitle}
          </h1>
          {firstRun && <p className="text-sm text-ink-soft">{sk.admin.firstRunHelp}</p>}
        </header>

        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <span className="block text-sm font-medium text-ink mb-1">
              {sk.admin.passwordLabel}
            </span>
            <input
              type="password"
              autoComplete="current-password"
              autoFocus
              required
              minLength={1}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-card bg-white border border-lavender-deep/20 focus:outline-none focus:ring-2 focus:ring-lavender-deep"
            />
          </label>

          {error && (
            <p role="alert" className="text-sm text-peach-deep font-medium">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || password.length === 0}
            className="w-full rounded-card bg-lavender-deep text-white py-3 font-semibold transition-colors hover:bg-lavender disabled:opacity-50"
          >
            {firstRun ? sk.admin.setupButton : sk.admin.loginButton}
          </button>
        </form>
      </div>
    </main>
  );
}
