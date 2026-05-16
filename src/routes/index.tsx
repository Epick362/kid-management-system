import { createFileRoute, Link } from "@tanstack/react-router";
import { sk } from "../lib/sk";
import { listActiveKidsFn } from "../server/kid-fns";

export const Route = createFileRoute("/")({
  loader: () => listActiveKidsFn(),
  component: Home,
});

function Home() {
  const { kids } = Route.useLoaderData();

  return (
    <main className="min-h-dvh px-6 py-10 flex flex-col items-center justify-center gap-8 max-w-md mx-auto">
      <header className="text-center space-y-2">
        <h1 className="text-4xl font-bold text-ink">{sk.app.title}</h1>
        <p className="text-ink-soft">{sk.home.pickKid}</p>
      </header>

      <section className="w-full space-y-3">
        {kids.length === 0 ? (
          <p className="text-center text-ink-soft">{sk.admin.kids.empty}</p>
        ) : (
          kids.map((k) => (
            <Link
              key={k.id}
              to="/kid/$kidId"
              params={{ kidId: String(k.id) }}
              className="flex items-center gap-4 w-full rounded-card bg-white hover:bg-white/90 shadow-sm px-5 py-4 transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              <span className="text-5xl">{k.avatarEmoji}</span>
              <span className="text-2xl font-semibold flex-1">{k.name}</span>
              <span className="text-2xl">▶️</span>
            </Link>
          ))
        )}
      </section>

      <div className="w-full pt-4 border-t border-ink-soft/15">
        <a
          href="/admin/login"
          className="block text-center text-sm text-ink-soft hover:text-ink py-2"
        >
          {sk.home.adminCta}
        </a>
      </div>
    </main>
  );
}
