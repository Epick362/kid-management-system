import { useEffect, useState } from "react";

/**
 * Number input that keeps an internal string draft so users can clear the
 * field and re-type naturally. Avoids the standard React anti-pattern of
 * `value={n}` + `onChange={e => setN(Number(e.target.value))}` which turns
 * an empty field into "0" and traps the caret.
 *
 * - Empty / partial drafts (including just "-") are tolerated while typing.
 * - On blur, an invalid draft is reverted to the last good value; otherwise
 *   it's clamped to [min, max] if those are set.
 */
export function NumberInput({
  value,
  onChange,
  min,
  max,
  className,
  required,
  autoFocus,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  className?: string;
  required?: boolean;
  autoFocus?: boolean;
}) {
  const [draft, setDraft] = useState<string>(String(value));

  // Sync when external value changes (e.g. parent reset). Skip if user is
  // mid-edit and the draft already round-trips to the same number.
  useEffect(() => {
    const parsed = Number.parseInt(draft, 10);
    if (Number.isNaN(parsed) || parsed !== value) {
      setDraft(String(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="-?[0-9]*"
      value={draft}
      onChange={(e) => {
        const next = e.target.value;
        setDraft(next);
        const n = Number.parseInt(next, 10);
        if (!Number.isNaN(n)) onChange(n);
      }}
      onBlur={() => {
        const n = Number.parseInt(draft, 10);
        if (Number.isNaN(n)) {
          setDraft(String(value));
          return;
        }
        let clamped = n;
        if (min !== undefined && clamped < min) clamped = min;
        if (max !== undefined && clamped > max) clamped = max;
        if (clamped !== n) {
          setDraft(String(clamped));
          onChange(clamped);
        }
      }}
      className={className}
      required={required}
      autoFocus={autoFocus}
    />
  );
}
