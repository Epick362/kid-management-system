import { createRootRoute, HeadContent, Link, Outlet, Scripts } from "@tanstack/react-router";
import { useEffect } from "react";
import globalsCss from "../styles/globals.css?url";
import { sk } from "../lib/sk";
import { registerServiceWorker } from "../lib/sw-register";
import { getErrorMessage } from "../lib/errors";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1",
      },
      { name: "theme-color", content: "#fdf8ee" },
      { title: sk.app.title },
      { name: "description", content: sk.app.description },

      // iOS PWA install support
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "KMS" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },

      // Hint to mobile browsers that this is a real PWA
      { name: "mobile-web-app-capable", content: "yes" },
    ],
    links: [
      { rel: "stylesheet", href: globalsCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/icon.svg", type: "image/svg+xml" },
      { rel: "icon", href: "/favicon-32.png", type: "image/png", sizes: "32x32" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
  }),
  component: RootDocument,
  errorComponent: ({ error, reset }) => <RootErrorView error={error} reset={reset} />,
});

function RootErrorView({ error, reset }: { error: unknown; reset: () => void }) {
  const msg = getErrorMessage(error, sk.errors.generic);
  // Show server-fn / loader failures with a friendly fallback instead of the
  // raw stack. Logs the full error so devtools / Workers tail still get it.
  if (typeof console !== "undefined") console.error("[root errorComponent]", error);
  return (
    <main className="min-h-dvh flex items-center justify-center px-4 py-10">
      <div className="bg-cream max-w-md w-full rounded-card p-6 shadow-xl space-y-4 text-center">
        <div className="text-4xl">⚠️</div>
        <h1 className="text-xl font-bold">{sk.errors.generic}</h1>
        <p className="text-sm text-ink-soft break-words">{msg}</p>
        <div className="flex gap-2 justify-center pt-2">
          <button
            type="button"
            onClick={reset}
            className="rounded-card bg-lavender-deep text-white px-4 py-2 text-sm font-medium"
          >
            {sk.errors.retry}
          </button>
          <Link
            to="/"
            className="rounded-card bg-white/70 px-4 py-2 text-sm font-medium hover:bg-white"
          >
            {sk.errors.home}
          </Link>
        </div>
      </div>
    </main>
  );
}

function RootDocument() {
  useEffect(() => {
    registerServiceWorker();
  }, []);

  return (
    <html lang="sk">
      <head>
        <HeadContent />
      </head>
      <body>
        <Outlet />
        <Scripts />
      </body>
    </html>
  );
}
