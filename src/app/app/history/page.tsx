"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getPB } from "@/lib/pb";
import { useAuth } from "@/providers/AuthProvider";
import type { TimeEntryType } from "@/lib/types";

interface Entry {
  id: string;
  type: TimeEntryType;
  method: string;
  at: string;
}
interface DayGroup {
  day: string; // YYYY-MM-DD
  entries: Entry[];
  minutes: number;
}

const TYPE_LABEL: Record<string, string> = {
  in: "Entrada",
  out: "Salida",
  break_start: "Inicio de pausa",
  break_end: "Fin de pausa",
};
const METHOD_LABEL: Record<string, string> = {
  manual: "manual",
  geo: "📍 ubicación",
  qr: "QR",
  nfc: "NFC",
  voice: "voz",
};

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}
function fmtDuration(min: number) {
  return `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, "0")}m`;
}
function fmtDayTitle(day: string) {
  const d = new Date(`${day}T12:00:00`);
  return d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
}

function minutesOfDay(entries: Entry[]): number {
  let total = 0;
  let open: number | null = null;
  for (const e of entries) {
    const t = new Date(e.at).getTime();
    if (e.type === "in" || e.type === "break_end") open = t;
    else if ((e.type === "out" || e.type === "break_start") && open != null) {
      total += t - open;
      open = null;
    }
  }
  if (open != null) total += Date.now() - open;
  return Math.round(total / 60000);
}

export default function HistoryPage() {
  const { user } = useAuth();
  const pb = getPB();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const since = new Date(Date.now() - days * 86_400_000);
    const list = await pb.collection("time_entries").getFullList<Entry>({
      filter: `user="${user.id}" && at>="${since.toISOString()}"`,
      sort: "at",
    });
    setEntries(list);
    setLoading(false);
  }, [pb, user, days]);

  useEffect(() => {
    load();
  }, [load]);

  const groups = useMemo<DayGroup[]>(() => {
    const byDay = new Map<string, Entry[]>();
    for (const e of entries) {
      const key = ymd(new Date(e.at));
      const arr = byDay.get(key) ?? [];
      arr.push(e);
      byDay.set(key, arr);
    }
    return [...byDay.entries()]
      .map(([day, es]) => ({ day, entries: es.sort((a, b) => a.at.localeCompare(b.at)), minutes: minutesOfDay(es) }))
      .sort((a, b) => b.day.localeCompare(a.day));
  }, [entries]);

  const totalMin = groups.reduce((a, g) => a + g.minutes, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Mi historial</h1>
          <p className="text-muted">
            {groups.length} días con fichajes · {fmtDuration(totalMin)} en total
          </p>
        </div>
        <div className="flex gap-2">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`rounded-full border px-3 py-1.5 text-sm transition ${
                days === d ? "border-primary bg-primary/10 text-primary" : "border-border bg-surface text-ink hover:border-primary"
              }`}
            >
              {d} días
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-muted">Cargando…</p>
      ) : groups.length === 0 ? (
        <p className="text-muted">No tienes fichajes en este periodo.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((g) => (
            <div key={g.day} className="rounded-[var(--radius)] border border-border bg-surface p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-display font-bold capitalize text-ink">{fmtDayTitle(g.day)}</h2>
                <span className="rounded-full bg-surface2 px-2.5 py-1 text-sm font-medium text-ink">{fmtDuration(g.minutes)}</span>
              </div>
              <ul className="mt-3 flex flex-col gap-2">
                {g.entries.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 text-sm">
                    <span className="font-display font-semibold tabular-nums text-ink">{fmtTime(e.at)}</span>
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    <span className="text-ink">{TYPE_LABEL[e.type] ?? e.type}</span>
                    <span className="ml-auto rounded-full bg-surface2 px-2 py-0.5 text-xs text-muted">
                      {METHOD_LABEL[e.method] ?? e.method}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
