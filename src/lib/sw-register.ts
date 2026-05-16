/**
 * Service-worker registration. Loaded from the client entry only (no SSR).
 * Skips registration entirely in dev to avoid stale-asset weirdness with HMR.
 */
export function registerServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  if (import.meta.env.DEV) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        // Listen for an updated worker waiting to activate.
        reg.addEventListener("updatefound", () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              showUpdateBanner(reg);
            }
          });
        });
      })
      .catch((err) => {
        console.warn("[sw] register failed", err);
      });
  });
}

function showUpdateBanner(reg: ServiceWorkerRegistration) {
  // Minimal hand-rolled toast — no React dependency so this works
  // before hydration if needed.
  if (document.getElementById("kms-sw-toast")) return;
  const div = document.createElement("div");
  div.id = "kms-sw-toast";
  div.style.cssText = [
    "position: fixed",
    "bottom: 16px",
    "left: 50%",
    "transform: translateX(-50%)",
    "z-index: 9999",
    "background: #8a6bd1",
    "color: #fdf8ee",
    "padding: 10px 16px",
    "border-radius: 18px",
    "font: 500 14px system-ui, sans-serif",
    "box-shadow: 0 8px 24px rgba(0,0,0,.18)",
    "display: flex",
    "gap: 12px",
    "align-items: center",
  ].join(";");
  div.innerHTML = `
    <span>Nová verzia je pripravená</span>
    <button style="background:#fdf8ee;color:#1a2a3a;border:0;border-radius:14px;padding:6px 12px;font-weight:600;cursor:pointer">Obnoviť</button>
  `;
  const btn = div.querySelector("button")!;
  btn.addEventListener("click", () => {
    reg.waiting?.postMessage("SKIP_WAITING");
    navigator.serviceWorker.addEventListener("controllerchange", () => location.reload(), { once: true });
  });
  document.body.appendChild(div);
}
