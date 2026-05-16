import { createFileRoute } from "@tanstack/react-router";
import { sk } from "../lib/sk";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <main className="min-h-dvh px-6 py-10 flex flex-col items-center justify-center gap-8">
      <header className="text-center space-y-2">
        <h1 className="text-4xl font-bold text-ink">{sk.app.title}</h1>
        <p className="text-ink-soft">{sk.home.tagline}</p>
      </header>

      <section className="w-full max-w-sm space-y-3">
        {/* Kid picker will go here once `kids` table is seeded */}
        {/* Admin login route added in next task. */}
        <a
          href="/admin/login"
          className="block w-full rounded-card bg-lavender hover:bg-lavender-deep hover:text-white text-center py-4 font-semibold transition-colors"
        >
          {sk.home.adminCta}
        </a>
      </section>
    </main>
  );
}
