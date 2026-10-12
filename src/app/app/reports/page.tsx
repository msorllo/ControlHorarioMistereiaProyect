"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getPB } from "@/lib/pb";
import { useAuth } from "@/providers/AuthProvider";
import { sessionsWithProject } from "@/lib/sessions";

interface Entry {
  user: string;
  type: string;
  at: string;
  project?: string;
}
interface Member {
  id: string;
  name: string;
  job_title?: string;
  active: boolean;
  hourly_rate?: number;
}
interface Project {
  id: string;
  name: string;
  client?: string;
  color?: string;
  icon?: string;
  billing_rate?: number;
}
interface ProjectRow {
  id: string;
  name: string;
  client?: string;
  color?: string;
  icon?: string;
  hours: number;
  cost: number;
  billed: number;
  margin: number;
}
interface Row {
  member: Member;
  days: number;
  hours: number;
  overtime: number;
  cost: number;
}

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}
function ymdLocal(iso: string): string {
  return ymd(new Date(iso));
}
const eur = (n: number) => n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Minutos trabajados por día para un empleado (pares entrada/salida y pausas). */
function minutesByDay(entries: Entry[]): Map<string, number> {
  const byDay = new Map<string, Entry[]>();
  for (const e of entries) {
    const key = ymdLocal(e.at);
    (byDay.get(key) ?? byDay.set(key, []).get(key)!).push(e);
  }
  const out = new Map<string, number>();
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
    out.set(day, Math.round(total / 60000));
  }
  return out;
}

export default function ReportsPage() {
  const { user, business } = useAuth();
  const pb = getPB();
  const canView = user?.role === "owner" || user?.role === "manager";

  const now = new Date();
  const [from, setFrom] = useState(ymd(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [to, setTo] = useState(ymd(now));
  const [members, setMembers] = useState<Member[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const projectsActive = business?.modules?.projects === true;

  const load = useCallback(async () => {
    if (!business) return;
    setLoading(true);
    const fromISO = new Date(`${from}T00:00:00`).toISOString();
    const toISO = new Date(`${to}T23:59:59`).toISOString();
    const [ppl, ent, projs] = await Promise.all([
      pb.collection("users").getFullList<Member>({ filter: `business="${business.id}"`, sort: "name" }),
      pb.collection("time_entries").getFullList<Entry>({
        filter: `business="${business.id}" && at>="${fromISO}" && at<="${toISO}"`,
        sort: "at",
      }),
      projectsActive
        ? pb.collection("projects").getFullList<Project>({ filter: `business="${business.id}"` })
        : Promise.resolve([] as Project[]),
    ]);
    setMembers(ppl.filter((m) => m.active !== false));
    setEntries(ent);
    setProjects(projs);
    setLoading(false);
  }, [pb, business, from, to, projectsActive]);

  useEffect(() => {
    load();
  }, [load]);

  function preset(kind: "thisMonth" | "lastMonth" | "thisWeek") {
    const d = new Date();
    if (kind === "thisMonth") {
      setFrom(ymd(new Date(d.getFullYear(), d.getMonth(), 1)));
      setTo(ymd(d));
    } else if (kind === "lastMonth") {
      setFrom(ymd(new Date(d.getFullYear(), d.getMonth() - 1, 1)));
      setTo(ymd(new Date(d.getFullYear(), d.getMonth(), 0)));
    } else {
      const mon = new Date(d);
      mon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      setFrom(ymd(mon));
      setTo(ymd(d));
    }
  }

  const rows = useMemo<Row[]>(() => {
    return members.map((m) => {
      const perDay = minutesByDay(entries.filter((e) => e.user === m.id));
      const days = [...perDay.values()].filter((min) => min > 0).length;
      const totalMin = [...perDay.values()].reduce((a, b) => a + b, 0);
      const hours = totalMin / 60;
      // Horas extra = lo que excede de 8 h en cada jornada.
      const overtime = [...perDay.values()].reduce((a, min) => a + Math.max(0, min - 480), 0) / 60;
      const rate = m.hourly_rate ?? 0;
      return { member: m, days, hours, overtime, cost: hours * rate };
    });
  }, [members, entries]);

  const totals = useMemo(
    () => rows.reduce((acc, r) => ({ hours: acc.hours + r.hours, overtime: acc.overtime + r.overtime, cost: acc.cost + r.cost }), { hours: 0, overtime: 0, cost: 0 }),
    [rows],
  );

  const projectRows = useMemo<ProjectRow[]>(() => {
    if (!projectsActive) return [];
    const rateOf = new Map(members.map((m) => [m.id, m.hourly_rate ?? 0]));
    const projMap = new Map(projects.map((p) => [p.id, p]));
    const agg = new Map<string, { minutes: number; cost: number }>();
    for (const m of members) {
      const rate = rateOf.get(m.id) ?? 0;
      for (const s of sessionsWithProject(entries.filter((e) => e.user === m.id))) {
        const key = s.project || "__none__";
        const cur = agg.get(key) ?? { minutes: 0, cost: 0 };
        cur.minutes += s.minutes;
        cur.cost += (s.minutes / 60) * rate;
        agg.set(key, cur);
      }
    }
    const out: ProjectRow[] = [];
    for (const [key, v] of agg) {
      if (v.minutes < 1) continue;
      const p = projMap.get(key);
      const hours = v.minutes / 60;
      const billed = hours * (p?.billing_rate ?? 0);
      out.push({ id: key, name: p?.name ?? "Sin proyecto", client: p?.client, color: p?.color ?? "#9ca3af", icon: p?.icon, hours, cost: v.cost, billed, margin: billed - v.cost });
    }
    return out.sort((a, b) => b.hours - a.hours);
  }, [projectsActive, members, entries, projects]);

  function downloadCSV() {
    const head = ["Empleado", "Puesto", "Días trabajados", "Horas", "Horas extra", "Tarifa €/h", "Coste €"];
    const lines = rows.map((r) =>
      [r.member.name, r.member.job_title ?? "", r.days, eur(r.hours), eur(r.overtime), eur(r.member.hourly_rate ?? 0), eur(r.cost)]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(";"),
    );
    const totalLine = ["TOTAL", "", "", eur(totals.hours), eur(totals.overtime), "", eur(totals.cost)]
      .map((v) => `"${v}"`)
      .join(";");
    const csv = "﻿" + [head.map((h) => `"${h}"`).join(";"), ...lines, totalLine].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `informe_horas_${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!canView) return <p className="text-muted">No tienes acceso a esta sección.</p>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Informe de horas y costes</h1>
          <p className="text-muted">Del {from} al {to} · para tu gestoría o control interno.</p>
        </div>
        <div className="no-print flex gap-2">
          <button onClick={downloadCSV} className="rounded-[var(--radius)] bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition hover:bg-primary-strong">
            ⬇️ Exportar CSV (Excel)
          </button>
          <button onClick={() => window.print()} className="rounded-[var(--radius)] border border-border bg-surface px-4 py-2 text-sm font-medium text-ink transition hover:border-primary">
            🖨️ Imprimir / PDF
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="no-print flex flex-wrap items-end gap-3 rounded-[var(--radius)] border border-border bg-surface p-4">
        <div className="flex gap-2">
          <button onClick={() => preset("thisMonth")} className="rounded-full border border-border bg-surface2 px-3 py-1.5 text-sm text-ink transition hover:border-primary">Este mes</button>
          <button onClick={() => preset("lastMonth")} className="rounded-full border border-border bg-surface2 px-3 py-1.5 text-sm text-ink transition hover:border-primary">Mes pasado</button>
          <button onClick={() => preset("thisWeek")} className="rounded-full border border-border bg-surface2 px-3 py-1.5 text-sm text-ink transition hover:border-primary">Esta semana</button>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink">Desde</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-[var(--radius)] border border-border bg-canvas px-3 py-2 text-ink outline-none focus:border-primary" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink">Hasta</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-[var(--radius)] border border-border bg-canvas px-3 py-2 text-ink outline-none focus:border-primary" />
        </label>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-[var(--radius)] border border-border bg-surface p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Horas totales</p>
          <p className="font-display text-2xl font-bold text-ink">{eur(totals.hours)} h</p>
        </div>
        <div className="rounded-[var(--radius)] border border-border bg-surface p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Horas extra</p>
          <p className="font-display text-2xl font-bold text-warning">{eur(totals.overtime)} h</p>
        </div>
        <div className="rounded-[var(--radius)] border border-border bg-surface p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Coste laboral</p>
          <p className="font-display text-2xl font-bold text-ink">{eur(totals.cost)} €</p>
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-[var(--radius)] border border-border bg-surface">
        {loading ? (
          <p className="p-5 text-muted">Calculando…</p>
        ) : (
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="px-4 py-3 font-medium">Empleado</th>
                <th className="px-4 py-3 font-medium">Días</th>
                <th className="px-4 py-3 font-medium">Horas</th>
                <th className="px-4 py-3 font-medium">Extra</th>
                <th className="px-4 py-3 font-medium">€/h</th>
                <th className="px-4 py-3 text-right font-medium">Coste</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.member.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink">{r.member.name}</p>
                    {r.member.job_title && <p className="text-xs text-muted">{r.member.job_title}</p>}
                  </td>
                  <td className="px-4 py-3 text-ink">{r.days}</td>
                  <td className="px-4 py-3 text-ink">{eur(r.hours)} h</td>
                  <td className="px-4 py-3 text-muted">{eur(r.overtime)} h</td>
                  <td className="px-4 py-3 text-muted">{r.member.hourly_rate ? `${eur(r.member.hourly_rate)} €` : "—"}</td>
                  <td className="px-4 py-3 text-right font-semibold text-ink">{eur(r.cost)} €</td>
                </tr>
              ))}
              <tr className="border-t-2 border-border bg-surface2 font-semibold">
                <td className="px-4 py-3 text-ink">TOTAL</td>
                <td className="px-4 py-3" />
                <td className="px-4 py-3 text-ink">{eur(totals.hours)} h</td>
                <td className="px-4 py-3 text-ink">{eur(totals.overtime)} h</td>
                <td className="px-4 py-3" />
                <td className="px-4 py-3 text-right text-ink">{eur(totals.cost)} €</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      {/* Desglose por proyecto */}
      {projectsActive && projectRows.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-bold text-ink">Rentabilidad por proyecto</h2>
          <div className="overflow-x-auto rounded-[var(--radius)] border border-border bg-surface">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted">
                  <th className="px-4 py-3 font-medium">Proyecto</th>
                  <th className="px-4 py-3 font-medium">Horas</th>
                  <th className="px-4 py-3 font-medium">Coste</th>
                  <th className="px-4 py-3 font-medium">Facturado</th>
                  <th className="px-4 py-3 text-right font-medium">Margen</th>
                </tr>
              </thead>
              <tbody>
                {projectRows.map((p) => (
                  <tr key={p.id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span>{p.icon ?? "📁"}</span>
                        <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
                        <div>
                          <p className="font-medium text-ink">{p.name}</p>
                          {p.client && <p className="text-xs text-muted">{p.client}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink">{eur(p.hours)} h</td>
                    <td className="px-4 py-3 text-muted">{eur(p.cost)} €</td>
                    <td className="px-4 py-3 text-ink">{p.billed > 0 ? `${eur(p.billed)} €` : "—"}</td>
                    <td className="px-4 py-3 text-right font-semibold" style={{ color: p.billed > 0 ? (p.margin >= 0 ? "var(--success)" : "var(--danger)") : "var(--text-muted)" }}>
                      {p.billed > 0 ? `${eur(p.margin)} €` : "—"}
                    </td>
                  </tr>
                ))}
                {(() => {
                  const t = projectRows.reduce((a, p) => ({ hours: a.hours + p.hours, cost: a.cost + p.cost, billed: a.billed + p.billed, margin: a.margin + p.margin }), { hours: 0, cost: 0, billed: 0, margin: 0 });
                  return (
                    <tr className="border-t-2 border-border bg-surface2 font-semibold">
                      <td className="px-4 py-3 text-ink">TOTAL</td>
                      <td className="px-4 py-3 text-ink">{eur(t.hours)} h</td>
                      <td className="px-4 py-3 text-ink">{eur(t.cost)} €</td>
                      <td className="px-4 py-3 text-ink">{eur(t.billed)} €</td>
                      <td className="px-4 py-3 text-right" style={{ color: t.margin >= 0 ? "var(--success)" : "var(--danger)" }}>{eur(t.margin)} €</td>
                    </tr>
                  );
                })()}
              </tbody>
            </table>
          </div>
          <p className="no-print text-xs text-muted">Facturado = horas × tarifa al cliente del proyecto. Margen = facturado − coste (horas × tarifa del empleado).</p>
        </div>
      )}

      <p className="no-print text-xs text-muted">
        La tarifa €/h se define por empleado en la sección Empleados. Las horas extra se cuentan como lo que excede de 8 h por jornada.
      </p>
    </div>
  );
}
