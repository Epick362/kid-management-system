import { sk } from "../lib/sk";
import type { DayColor } from "../server/screen-time";
import { daysInMonth, firstWeekdayMondayLead } from "../lib/dates";

export interface CalendarDay {
  /** "YYYY-MM-DD" */
  key: string;
  color: DayColor;
  dailyDoneCount: number;
  weeklyDoneCount: number;
  minutesUsed: number;
}

interface Props {
  year: number;
  /** 1-based month (1 = January). */
  month: number;
  days: CalendarDay[];
  onNavigate?: (year: number, month: number) => void;
  onDayClick?: (key: string) => void;
}

const COLOR_CLASSES: Record<DayColor, string> = {
  green: "bg-mint-deep text-white",
  red: "bg-peach-deep text-white",
  neutral: "bg-sky/40 text-ink",
  blank: "bg-transparent text-ink-soft",
};

export function CalendarGrid({ year, month, days, onNavigate, onDayClick }: Props) {
  const total = daysInMonth(year, month);
  const offset = firstWeekdayMondayLead(year, month);
  const dayByKey = new Map(days.map((d) => [d.key, d]));

  const cells: Array<{ day: number; data: CalendarDay | null } | null> = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= total; d++) {
    const key = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ day: d, data: dayByKey.get(key) ?? null });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  function nav(delta: number) {
    if (!onNavigate) return;
    let nm = month + delta;
    let ny = year;
    if (nm < 1) { nm = 12; ny--; }
    if (nm > 12) { nm = 1; ny++; }
    onNavigate(ny, nm);
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => nav(-1)}
          className="p-2 rounded-card hover:bg-white/70"
          aria-label="prev"
        >
          ◀
        </button>
        <h3 className="font-semibold">
          {sk.calendar.months[month - 1]} {year}
        </h3>
        <button
          type="button"
          onClick={() => nav(+1)}
          className="p-2 rounded-card hover:bg-white/70"
          aria-label="next"
        >
          ▶
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-ink-soft mb-1">
        {sk.calendar.weekdaysShort.map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, idx) => {
          if (!cell) return <div key={idx} className="aspect-square" />;
          const color: DayColor = cell.data?.color ?? "blank";
          const daily = cell.data?.dailyDoneCount ?? 0;
          const weekly = cell.data?.weeklyDoneCount ?? 0;
          const used = cell.data?.minutesUsed ?? 0;
          const label = used > 0 ? `${cell.day} · ${used} min` : `${cell.day}`;
          const clickable = !!onDayClick && !!cell.data;
          const baseCls =
            "aspect-square rounded-md flex flex-col items-center justify-center text-sm font-medium " +
            COLOR_CLASSES[color];
          const content = (
            <>
              <span>{cell.day}</span>
              {(daily > 0 || weekly > 0) && (
                <span className="text-[10px] opacity-90 leading-tight">
                  {daily > 0 && <span>★{daily}</span>}
                  {daily > 0 && weekly > 0 && " "}
                  {weekly > 0 && <span>🏆{weekly}</span>}
                </span>
              )}
            </>
          );
          if (clickable) {
            return (
              <button
                key={idx}
                type="button"
                title={label}
                onClick={() => onDayClick!(cell.data!.key)}
                className={baseCls + " hover:ring-2 hover:ring-ink/40 cursor-pointer"}
              >
                {content}
              </button>
            );
          }
          return (
            <div key={idx} title={label} className={baseCls}>
              {content}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3 mt-4 text-xs text-ink-soft">
        <Legend color="green" label={sk.calendar.legend.green} />
        <Legend color="red" label={sk.calendar.legend.red} />
        <Legend color="neutral" label={sk.calendar.legend.neutral} />
        <span className="flex items-center gap-1.5">★ {sk.calendar.legend.daily}</span>
        <span className="flex items-center gap-1.5">🏆 {sk.calendar.legend.weekly}</span>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: DayColor; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block w-3 h-3 rounded ${COLOR_CLASSES[color]}`} />
      {label}
    </span>
  );
}
