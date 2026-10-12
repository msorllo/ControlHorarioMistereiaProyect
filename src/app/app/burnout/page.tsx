"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getPB } from "@/lib/pb";
import { useAuth } from "@/providers/AuthProvider";

interface Entry {
  user: string;
  type: string;
  at: string;
}
interface Shift {
  user: string;
  date: string;
}
interface Member {
  id: string;
  name: string;
  active: boolean;
}

type Level = "ok" | "watch" | "risk";

interface Report {
  member: Member;
  hours7: number;
  consecutive: number;
  longDays: number;
  upcomingDays: number;
  points: number;
  level: Level;
  reasons: string[];
}

const LEVEL_META: Record<Level, { label: string; color: string; emoji: string }> = {
  ok: { label: "Bien", color: "var(--success)", emoji: "🟢" },
  watch: { label: "Vigilar", color: "var(--warning)", emoji: "🟡" },
  risk: { label: "Riesgo alto", color: "var(--danger)", emoji: "🔴" },
};

function ymdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

/** Minutos trabajados por día (clave YYYY-MM-DD) a partir de los fichajes. */
function workedMinutesByDay(entries: Entry[]): Map<string, number> {
  const byDay = new Map<string, Entry[]>();
  for (const e of entries) {
    const key = ymdLocal(new Date(e.at));
    const arr = byDay.get(key) ?? [];
    arr.push(e);
    byDay.set(key, arr);
  }
  const result = new Map<string, number>();
  for (const [day, list] of byDay) {
    list.sort((a, b) => a.at.localeCompare(b.at));
    let total = 0;
    let open: number | null = null;
    for (const e of list) {
      const t = new Date(e.at).getTime();
      if (e.type === "in" || e.type === "break_end") open = t;
      else if ((e.type === "out" || e.type === "break_start") && open != null) {
        total += t - open;
        open = null;
      }
    }
    result.set(day, Math.round(total / 60000));
  }
  return result;
}

/** Racha de días consecutivos trabajados terminando en el día más reciente. */
function maxConsecutive(daysWorked: Set<string>): number {
  if (daysWorked.size === 0) return 0;
  const sorted = [...daysWorked].sort();
  let best = 1;
  let cur = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]);
    const now = new Date(sorted[i]);
    const diff = (now.getTime() - prev.getTime()) / 86_400_000;
    if (diff === 1) cur++;
    else cur = 1;
    best = Math.max(best, cur);
  }
  return best;
}

export default function BurnoutPage() {
  const { user, business } = useAuth();
  const pb = getPB();
  const canView = user?.role === "owner" || user?.role === "manager";

  const [members, setMembers] = useState<Member[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!business) return;
    const sevenAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const today = ymdLocal(new Date());
    const in7 = ymdLocal(new Date(Date.now() + 7 * 86_400_000));
    const [ppl, ent, sh] = await Promise.all([
      pb.collection("users").getFullList<Member>({ filter: `business="${business.id}"`, sort: "name" }),
      pb.collection("time_entries").getFullList<Entry>({ filter: `business="${business.id}" && at>="${sevenAgo}"`, sort: "at" }),
      pb.collection("shifts").getFullList<Shift>({ filter: `business="${business.id}" && date>="${today}" && date<="${in7}"` }),
    ]);
    setMembers(ppl.filter((m) => m.active !== false));
    setEntries(ent);
    setShifts(sh);
    setLoading(false);
  }, [pb, business]);

  useEffect(() => {
    load();
  }, [load]);

  const reports = useMemo<Report[]>(() => {
    return members
      .map((m) => {
        const mine = entries.filter((e) => e.user === m.id);
        const perDay = workedMinutesByDay(mine);
        const hours7 = [...perDay.values()].reduce((a, b) => a + b, 0) / 60;
        const daysWorked = new Set([...perDay.entries()].filter(([, min]) => min > 0).map(([d]) => d));
        const consecutive = maxConsecutive(daysWorked);
        const longDays = [...perDay.values()].filter((min) => min > 9 * 60).length;
        const upcomingDays = new Set(shifts.filter((s) => s.user === m.id).map((s) => s.date)).size;

        let points = 0;
        const reasons: string[] = [];
        if (hours7 > 45) { points += 2; reasons.push(`${hours7.toFixed(0)} h en 7 días (muy alto)`); }
        else if (hours7 > 40) { points += 1; reasons.push(`${hours7.toFixed(0)} h en 7 días`); }
        if (consecutive >= 6) { points += 2; reasons.push(`${consecutive} días seguidos trabajando`); }
        else if (consecutive >= 5) { points += 1; reasons.push(`${consecutive} días seguidos`); }
        if (longDays >= 3) { points += 2; reasons.push(`${longDays} jornadas de +9 h`); }
        else if (longDays >= 2) { points += 1; reasons.push(`${longDays} jornadas largas`); }
        if (upcomingDays >= 6) { points += 1; reasons.push("Próxima semana muy cargada"); }

        const level: Level = points >= 4 ? "risk" : points >= 2 ? "watch" : "ok";
        return { member: m, hours7, consecutive, longDays, upcomingDays, points, level, reasons };
      })
      .sort((a, b) => b.points - a.points);
  }, [members, entries, shifts]);

  if (!canView) return <p className="text-muted">No tienes acceso a esta sección.</p>;

  const counts = { risk: reports.filter((r) => r.level === "risk").length, watch: reports.filter((r) => r.level === "watch").length, ok: reports.filter((r) => r.level === "ok").length };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Bienestar del equipo</h1>
        <p className="text-muted">Detecta fatiga antes de que sea un problema. Basado en fichajes (7 días) y turnos previstos.</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-[var(--radius)] border border-border bg-surface p-4">
          <p className="text-xs uppercase tracking-wide text-muted">🔴 Riesgo alto</p>
          <p className="font-display text-2xl font-bold text-danger">{counts.risk}</p>
        </div>
        <div className="rounded-[var(--radius)] border border-border bg-surface p-4">
          <p className="text-xs uppercase tracking-wide text-muted">🟡 Vigilar</p>
          <p className="font-display text-2xl font-bold text-warning">{counts.watch}</p>
        </div>
        <div className="rounded-[var(--radius)] border border-border bg-surface p-4">
          <p className="text-xs uppercase tracking-wide text-muted">🟢 Bien</p>
          <p className="font-display text-2xl font-bold text-success">{counts.ok}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-[var(--radius)] border border-border bg-surface">
        {loading ? (
          <p className="p-5 text-muted">Analizando…</p>
        ) : reports.length === 0 ? (
          <p className="p-5 text-muted">No hay empleados que analizar.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {reports.map((r) => (
              <li key={r.member.id} className="flex items-start gap-4 px-4 py-3">
                <span className="mt-0.5 text-lg" title={LEVEL_META[r.level].label}>{LEVEL_META[r.level].emoji}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-ink">{r.member.name}</p>
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-medium"
                      style={{ color: LEVEL_META[r.level].color, backgroundColor: `color-mix(in srgb, ${LEVEL_META[r.level].color} 14%, transparent)` }}
                    >
                      {LEVEL_META[r.level].label}
                    </span>
                  </div>
                  {r.reasons.length > 0 ? (
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {r.reasons.map((reason, i) => (
                        <span key={i} className="rounded-full bg-surface2 px-2 py-0.5 text-xs text-muted">{reason}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-1 text-xs text-muted">Carga de trabajo equilibrada esta semana.</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-display text-sm font-semibold text-ink">{r.hours7.toFixed(1)} h</p>
                  <p className="text-xs text-muted">últimos 7 días</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-muted">
        Umbrales orientativos (jornada larga &gt; 9 h, semana alta &gt; 40 h, 5+ días seguidos). Configurables en una fase futura.
      </p>
    </div>
  );
}
