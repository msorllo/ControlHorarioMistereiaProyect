"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getPB } from "@/lib/pb";
import { useAuth } from "@/providers/AuthProvider";

interface Shift {
  id: string;
  user: string;
  date: string; // YYYY-MM-DD
  start_time: string; // HH:mm
  end_time: string;
  note?: string;
}
interface Member {
  id: string;
  name: string;
  active: boolean;
}

const DAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function mondayOf(d: Date): Date {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // lunes = 0
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}
function fmtDayLabel(d: Date): string {
  return `${d.getDate()}/${d.getMonth() + 1}`;
}
/** Duración de un turno en horas (soporta turnos que cruzan medianoche). */
function shiftHours(s: Shift): number {
  const [h1, m1] = s.start_time.split(":").map(Number);
  const [h2, m2] = s.end_time.split(":").map(Number);
  let mins = h2 * 60 + m2 - (h1 * 60 + m1);
  if (mins < 0) mins += 24 * 60;
  return mins / 60;
}

export default function ShiftsPage() {
  const { user, business } = useAuth();
  const pb = getPB();
  const isManager = user?.role === "owner" || user?.role === "manager";

  const [weekStart, setWeekStart] = useState<Date>(() => mondayOf(new Date()));
  const [members, setMembers] = useState<Member[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);

  // Formulario de nuevo turno
  const [fUser, setFUser] = useState("");
  const [fDate, setFDate] = useState("");
  const [fStart, setFStart] = useState("09:00");
  const [fEnd, setFEnd] = useState("17:00");
  const [fNote, setFNote] = useState("");
  const [saving, setSaving] = useState(false);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const weekEnd = days[6];

  const load = useCallback(async () => {
    if (!business || !user) return;
    const monYMD = toYMD(weekStart);
    const sunYMD = toYMD(addDays(weekStart, 6));

    const ppl = isManager
      ? await pb.collection("users").getFullList<Member>({ filter: `business="${business.id}"`, sort: "name" })
      : [{ id: user.id, name: user.name, active: true }];

    const filter = isManager
      ? `business="${business.id}" && date>="${monYMD}" && date<="${sunYMD}"`
      : `business="${business.id}" && user="${user.id}" && date>="${monYMD}" && date<="${sunYMD}"`;
    const list = await pb.collection("shifts").getFullList<Shift>({ filter, sort: "start_time" });

    setMembers(ppl.filter((m) => m.active !== false));
    setShifts(list);
    setLoading(false);
  }, [pb, business, user, weekStart, isManager]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (isManager && !fUser && members.length) setFUser(members[0].id);
    if (!fDate) setFDate(toYMD(weekStart));
  }, [members, isManager, fUser, fDate, weekStart]);

  async function addShift(e: React.FormEvent) {
    e.preventDefault();
    if (!business || !fUser || !fDate) return;
    setSaving(true);
    try {
      await pb.collection("shifts").create({
        business: business.id,
        user: fUser,
        date: fDate,
        start_time: fStart,
        end_time: fEnd,
        note: fNote,
        created_by: user?.id,
      });
      setFNote("");
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function removeShift(id: string) {
    await pb.collection("shifts").delete(id);
    await load();
  }

  const shiftsByCell = useMemo(() => {
    const map = new Map<string, Shift[]>();
    for (const s of shifts) {
      const key = `${s.user}|${s.date}`;
      const arr = map.get(key) ?? [];
      arr.push(s);
      map.set(key, arr);
    }
    return map;
  }, [shifts]);

  const totalWeekHours = useMemo(() => shifts.reduce((sum, s) => sum + shiftHours(s), 0), [shifts]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Cuadrante de turnos</h1>
          <p className="text-muted">
            Semana del {fmtDayLabel(weekStart)} al {fmtDayLabel(weekEnd)} · {totalWeekHours.toFixed(1)} h planificadas
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setWeekStart(addDays(weekStart, -7))} className="rounded-full border border-border bg-surface px-3 py-1.5 text-sm text-ink transition hover:border-primary">← Anterior</button>
          <button onClick={() => setWeekStart(mondayOf(new Date()))} className="rounded-full border border-border bg-surface px-3 py-1.5 text-sm text-ink transition hover:border-primary">Hoy</button>
          <button onClick={() => setWeekStart(addDays(weekStart, 7))} className="rounded-full border border-border bg-surface px-3 py-1.5 text-sm text-ink transition hover:border-primary">Siguiente →</button>
        </div>
      </div>

      {isManager && (
        <form onSubmit={addShift} className="grid gap-3 rounded-[var(--radius)] border border-border bg-surface p-4 sm:grid-cols-3 lg:grid-cols-6">
          <label className="flex flex-col gap-1 text-sm lg:col-span-2">
            <span className="font-medium text-ink">Empleado</span>
            <select value={fUser} onChange={(e) => setFUser(e.target.value)} className="rounded-[var(--radius)] border border-border bg-canvas px-3 py-2 text-ink outline-none focus:border-primary">
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-ink">Día</span>
            <select value={fDate} onChange={(e) => setFDate(e.target.value)} className="rounded-[var(--radius)] border border-border bg-canvas px-3 py-2 text-ink outline-none focus:border-primary">
              {days.map((d, i) => (
                <option key={i} value={toYMD(d)}>{DAY_NAMES[i]} {fmtDayLabel(d)}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-ink">Inicio</span>
            <input type="time" value={fStart} onChange={(e) => setFStart(e.target.value)} className="rounded-[var(--radius)] border border-border bg-canvas px-3 py-2 text-ink outline-none focus:border-primary" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-ink">Fin</span>
            <input type="time" value={fEnd} onChange={(e) => setFEnd(e.target.value)} className="rounded-[var(--radius)] border border-border bg-canvas px-3 py-2 text-ink outline-none focus:border-primary" />
          </label>
          <label className="flex flex-col gap-1 text-sm lg:col-span-5">
            <span className="font-medium text-ink">Nota (opcional)</span>
            <input value={fNote} onChange={(e) => setFNote(e.target.value)} placeholder="p. ej. Caja / apertura" className="rounded-[var(--radius)] border border-border bg-canvas px-3 py-2 text-ink outline-none focus:border-primary" />
          </label>
          <div className="flex items-end">
            <button type="submit" disabled={saving} className="w-full rounded-[var(--radius)] bg-primary px-4 py-2 font-semibold text-on-primary transition hover:bg-primary-strong disabled:opacity-60">
              {saving ? "…" : "Añadir turno"}
            </button>
          </div>
        </form>
      )}

      {/* Rejilla semanal */}
      <div className="overflow-x-auto rounded-[var(--radius)] border border-border bg-surface">
        {loading ? (
          <p className="p-5 text-muted">Cargando cuadrante…</p>
        ) : members.length === 0 ? (
          <p className="p-5 text-muted">No hay empleados que planificar.</p>
        ) : (
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="sticky left-0 z-10 bg-surface px-3 py-2 text-left font-medium text-muted">Empleado</th>
                {days.map((d, i) => {
                  const isToday = toYMD(d) === toYMD(new Date());
                  return (
                    <th key={i} className={`px-2 py-2 text-center font-medium ${isToday ? "text-primary" : "text-muted"}`}>
                      {DAY_NAMES[i]}<br />
                      <span className="text-xs font-normal">{fmtDayLabel(d)}</span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-b border-border/60 last:border-0">
                  <td className="sticky left-0 z-10 bg-surface px-3 py-2 font-medium text-ink">{m.name}</td>
                  {days.map((d, i) => {
                    const cell = shiftsByCell.get(`${m.id}|${toYMD(d)}`) ?? [];
                    return (
                      <td key={i} className="min-w-[90px] px-1.5 py-1.5 align-top">
                        <div className="flex flex-col gap-1">
                          {cell.map((s) => (
                            <div key={s.id} className="group rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-left">
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-semibold text-primary">{s.start_time}–{s.end_time}</span>
                                {isManager && (
                                  <button onClick={() => removeShift(s.id)} className="text-muted opacity-0 transition group-hover:opacity-100 hover:text-danger" aria-label="Quitar">✕</button>
                                )}
                              </div>
                              {s.note && <p className="truncate text-xs text-muted">{s.note}</p>}
                            </div>
                          ))}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
