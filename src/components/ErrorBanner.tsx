/**
 * Inline error banner. Use above forms or action buttons to surface
 * server-fn / D1 / validation failures to the user.
 */
export function ErrorBanner({
  message,
  onDismiss,
}: {
  message: string | null | undefined;
  onDismiss?: () => void;
}) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="bg-peach/60 border border-peach-deep/50 rounded-card px-3 py-2 mb-3 text-sm flex items-start gap-2"
    >
      <span aria-hidden>⚠️</span>
      <div className="flex-1 break-words">{message}</div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="text-xs text-ink-soft hover:underline shrink-0"
          aria-label="dismiss"
        >
          ✕
        </button>
      )}
    </div>
  );
}
