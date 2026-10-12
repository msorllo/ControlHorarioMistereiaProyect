"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getPB } from "@/lib/pb";
import { useAuth } from "@/providers/AuthProvider";
import type { TimeEntryType } from "@/lib/types";

interface Entry {
  id: string;
  user: string;
  type: TimeEntryType;
  at: string;
}
interface Member {
  id: string;
  name: string;
  job_title?: string;
  active: boolean;
}
interface Absence {
  id: string;
  user: string;
  type: string;
  start_date: string;
  end_date: string;
  note?: string;
  status: string;
  suggested_by_ai?: boolean;
}

const ABSENCE_LABEL: Record<string, string> = {
  sick: "Baja por enfermedad",
  vacation: "Vacaciones",
  personal: "Asunto personal",
  other: "Ausencia",
};
type WorkState = "out" | "in" | "break";

function startOfTodayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}
function fmtDuration(ms: number) {
  const min = Math.max(0, Math.floor(ms / 60000));
  return `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, "0")}m`;
}
function computeWorkedMs(entries: Entry[]) {
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
  return total;
}

const STATE_META: Record<WorkState, { label: string; color: string }> = {
  in: { label: "Trabajando", color: "var(--success)" },
  break: { label: "En pausa", color: "var(--warning)" },
  out: { label: "Fuera", color: "var(--text-muted)" },
};

export default function TeamPage() {
  const { user, business } = useAuth();
  const pb = getPB();
  const [members, setMembers] = useState<Member[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [loading, setLoading] = useState(true);

  const canView = user?.role === "owner" || user?.role === "manager";

  const load = useCallback(async () => {
    if (!business) return;
    const [ppl, ent, abs] = await Promise.all([
      pb.collection("users").getFullList<Member>({ filter: `business="${business.id}"`, sort: "name" }),
      pb.collection("time_entries").getFullList<Entry>({
        filter: `business="${business.id}" && at>="${startOfTodayISO()}"`,
        sort: "at",
      }),
      pb.collection("absences").getFullList<Absence>({
        filter: `business="${business.id}" && status="pending"`,
        sort: "start_date",
      }),
    ]);
    setMembers(ppl);
    setEntries(ent);
    setAbsences(abs);
    setLoading(false);
  }, [pb, business]);

  async function resolveAbsence(id: string, status: "approved" | "rejected") {
    await pb.collection("absences").update(id, { status, resolved_by: user?.id });
    await load();
  }

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(() => {
    return members
      .filter((m) => m.active)
      .map((m) => {
        const mine = entries.filter((e) => e.user === m.id);
        const last = mine[mine.length - 1];
        const state: WorkState = !last || last.type === "out" ? "out" : last.type === "break_start" ? "break" : "in";
        return { member: m, state, worked: computeWorkedMs(mine), lastAt: last?.at, count: mine.length };
      })
      .sort((a, b) => (a.state === "out" ? 1 : 0) - (b.state === "out" ? 1 : 0));
  }, [members, entries]);

  if (!canView) return <p className="text-muted">No tienes acceso a esta sección.</p>;

  const working = rows.filter((r) => r.state === "in").length;
  const onBreak = rows.filter((r) => r.state === "break").length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Equipo · Hoy</h1>
        <p className="text-muted">Estado del equipo en tiempo real y horas del día.</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-[var(--radius)] border border-border bg-surface p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Trabajando</p>
          <p className="font-display text-2xl font-bold text-success">{working}</p>
        </div>
        <div className="rounded-[var(--radius)] border border-border bg-surface p-4">
          <p className="text-xs uppercase tracking-wide text-muted">En pausa</p>
          <p className="font-display text-2xl font-bold text-warning">{onBreak}</p>
        </div>
        <div className="rounded-[var(--radius)] border border-border bg-surface p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Equipo activo</p>
          <p className="font-display text-2xl font-bold text-ink">{rows.length}</p>
        </div>
      </div>

      {absences.length > 0 && (
        <div className="rounded-[var(--radius)] border border-warning/40 bg-surface p-5">
          <h2 className="font-display text-lg font-bold text-ink">🟡 Ausencias pendientes de aprobar</h2>
          <ul className="mt-3 flex flex-col gap-3">
            {absences.map((a) => {
              const who = members.find((m) => m.id === a.user)?.name ?? "Empleado";
              return (
                <li key={a.id} className="flex flex-wrap items-center gap-3 rounded-[var(--radius)] bg-surface2 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink">
                      {who} · {ABSENCE_LABEL[a.type] ?? a.type}
                      {a.suggested_by_ai && (
                        <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
                          vía asistente IA
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted">
                      Del {a.start_date.slice(0, 10)} al {a.end_date.slice(0, 10)}
                      {a.note ? ` · «${a.note}»` : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => resolveAbsence(a.id, "approved")}
                      className="rounded-full bg-success px-3 py-1.5 text-sm font-semibold text-white transition hover:opacity-90"
                    >
                      Aprobar
                    </button>
                    <button
                      onClick={() => resolveAbsence(a.id, "rejected")}
                      className="rounded-full border border-border bg-surface px-3 py-1.5 text-sm text-ink transition hover:border-danger hover:text-danger"
                    >
                      Rechazar
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="overflow-hidden rounded-[var(--radius)] border border-border bg-surface">
        {loading ? (
          <p className="p-5 text-muted">Cargando…</p>
        ) : rows.length === 0 ? (
          <p className="p-5 text-muted">No hay empleados activos todavía.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {rows.map(({ member, state, worked, lastAt, count }) => (
              <li key={member.id} className="flex items-center gap-4 px-4 py-3">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: STATE_META[state].color }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink">{member.name}</p>
                  <p className="truncate text-xs text-muted">
                    {STATE_META[state].label}
                    {lastAt ? ` · último fichaje ${fmtTime(lastAt)}` : " · sin fichar"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display text-sm font-semibold text-ink">{fmtDuration(worked)}</p>
                  <p className="text-xs text-muted">{count} fichajes</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
