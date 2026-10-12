"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getPB } from "@/lib/pb";
import { useAuth } from "@/providers/AuthProvider";
import { fetchRoster, type RosterMember } from "@/lib/roster";

interface Kudo {
  id: string;
  from_user: string;
  to_user: string;
  emoji?: string;
  message?: string;
  created: string;
}
interface Entry {
  type: string;
  at: string;
}
interface Shift {
  date: string;
  start_time: string;
}

const EMOJIS = ["🏆", "🙌", "💪", "⭐", "🚀", "❤️", "👏", "🔥"];
const GRACE_MIN = 5;

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}
function timeToMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
function minuteOfLocalDay(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}
function fmtWhen(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function RewardsPage() {
  const { user, business } = useAuth();
  const pb = getPB();

  const [members, setMembers] = useState<RosterMember[]>([]);
  const [kudos, setKudos] = useState<Kudo[]>([]);
  const [myEntries, setMyEntries] = useState<Entry[]>([]);
  const [myShifts, setMyShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);

  const [toUser, setToUser] = useState("");
  const [emoji, setEmoji] = useState("🏆");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!business || !user) return;
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const [roster, ks, ent, sh] = await Promise.all([
      fetchRoster(),
      pb.collection("kudos").getFullList<Kudo>({ filter: `business="${business.id}"`, sort: "-created" }),
      pb.collection("time_entries").getFullList<Entry>({ filter: `user="${user.id}" && type="in" && at>="${monthStart.toISOString()}"`, sort: "at" }),
      pb.collection("shifts").getFullList<Shift>({ filter: `user="${user.id}" && date>="${ymd(monthStart)}"` }),
    ]);
    setMembers(roster.filter((m) => m.active !== false));
    setKudos(ks);
    setMyEntries(ent);
    setMyShifts(sh);
    setLoading(false);
  }, [pb, business, user]);

  useEffect(() => {
    load();
  }, [load]);

  const nameOf = useMemo(() => {
    const map = new Map(members.map((m) => [m.id, m.name]));
    return (id: string) => map.get(id) ?? "Alguien";
  }, [members]);

  // Ranking del equipo por kudos recibidos (visible a todos).
  const ranking = useMemo(() => {
    const counts = new Map<string, number>();
    for (const k of kudos) counts.set(k.to_user, (counts.get(k.to_user) ?? 0) + 1);
    return members
      .map((m) => ({ member: m, kudos: counts.get(m.id) ?? 0 }))
      .sort((a, b) => b.kudos - a.kudos);
  }, [members, kudos]);

  // Mi puntualidad este mes (con mis propios datos: turno vs primer fichaje).
  const myPunctuality = useMemo(() => {
    const firstIn = new Map<string, number>();
    for (const e of myEntries) {
      const key = ymd(new Date(e.at));
      if (!firstIn.has(key)) firstIn.set(key, minuteOfLocalDay(e.at));
    }
    const evalDays: { day: string; ok: boolean }[] = [];
    for (const s of myShifts) {
      const fi = firstIn.get(s.date);
      if (fi === undefined) continue;
      evalDays.push({ day: s.date, ok: fi <= timeToMin(s.start_time) + GRACE_MIN });
    }
    const evaluated = evalDays.length;
    const punctual = evalDays.filter((d) => d.ok).length;
    evalDays.sort((a, b) => b.day.localeCompare(a.day));
    let streak = 0;
    for (const d of evalDays) {
      if (d.ok) streak++;
      else break;
    }
    return { pct: evaluated ? Math.round((punctual / evaluated) * 100) : null, streak, evaluated };
  }, [myEntries, myShifts]);

  const myKudos = kudos.filter((k) => k.to_user === user?.id).length;

  async function give(e: React.FormEvent) {
    e.preventDefault();
    if (!business || !user || !toUser) return;
    setSaving(true);
    try {
      await pb.collection("kudos").create({ business: business.id, from_user: user.id, to_user: toUser, emoji, message: message.trim() });
      setMessage("");
      setToUser("");
      await load();
    } finally {
      setSaving(false);
    }
  }

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Reconocimientos y logros</h1>
        <p className="text-muted">Celebra a tu equipo y motiva la puntualidad. Los datos son de este mes.</p>
      </div>

      {/* Mis logros */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-[var(--radius)] border border-border bg-surface p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Mis kudos</p>
          <p className="font-display text-2xl font-bold text-primary">{myKudos}</p>
        </div>
        <div className="rounded-[var(--radius)] border border-border bg-surface p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Mi puntualidad</p>
          <p className="font-display text-2xl font-bold text-ink">{myPunctuality.pct === null ? "—" : `${myPunctuality.pct}%`}</p>
        </div>
        <div className="rounded-[var(--radius)] border border-border bg-surface p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Mi racha</p>
          <p className="font-display text-2xl font-bold text-warning">{myPunctuality.streak > 0 ? `🔥 ${myPunctuality.streak}` : "0"}</p>
        </div>
      </div>

      {/* Dar reconocimiento */}
      <form onSubmit={give} className="flex flex-col gap-3 rounded-[var(--radius)] border border-border bg-surface p-5">
        <h2 className="font-display text-lg font-bold text-ink">Dar un reconocimiento</h2>
        <div className="flex flex-wrap gap-2">
          {EMOJIS.map((em) => (
            <button key={em} type="button" onClick={() => setEmoji(em)}
              className={`flex h-10 w-10 items-center justify-center rounded-full text-xl transition ${emoji === em ? "bg-primary/15 ring-2 ring-primary" : "bg-surface2 hover:bg-border"}`}>
              {em}
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_2fr_auto]">
          <select value={toUser} onChange={(e) => setToUser(e.target.value)} className="rounded-[var(--radius)] border border-border bg-canvas px-3 py-2 text-ink outline-none focus:border-primary">
            <option value="">¿A quién?</option>
            {members.filter((m) => m.id !== user?.id).map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Por qué se lo merece…" className="rounded-[var(--radius)] border border-border bg-canvas px-3 py-2 text-ink outline-none focus:border-primary" />
          <button type="submit" disabled={saving || !toUser} className="rounded-[var(--radius)] bg-primary px-4 py-2 font-semibold text-on-primary transition hover:bg-primary-strong disabled:opacity-50">
            {emoji} Enviar
          </button>
        </div>
      </form>

      {/* Ranking por kudos */}
      <div>
        <h2 className="font-display text-lg font-bold text-ink">Ranking del equipo (kudos)</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            <p className="text-muted">Cargando…</p>
          ) : (
            ranking.map((r, i) => (
              <div key={r.member.id} className="flex items-center justify-between rounded-[var(--radius)] border border-border bg-surface p-4">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{medals[i] ?? "🎖️"}</span>
                  <div>
                    <p className="font-medium text-ink">{r.member.name}</p>
                    {r.member.job_title && <p className="text-xs text-muted">{r.member.job_title}</p>}
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-display text-xl font-bold text-primary">{r.kudos}</p>
                  <p className="text-xs text-muted">kudos</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Muro de reconocimientos */}
      <div>
        <h2 className="font-display text-lg font-bold text-ink">Muro de reconocimientos</h2>
        <div className="mt-3 overflow-hidden rounded-[var(--radius)] border border-border bg-surface">
          {kudos.length === 0 ? (
            <p className="p-5 text-muted">Aún no hay reconocimientos. ¡Sé el primero en dar uno!</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {kudos.slice(0, 20).map((k) => (
                <li key={k.id} className="flex items-start gap-3 px-4 py-3">
                  <span className="text-2xl">{k.emoji ?? "🏆"}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink">
                      <strong>{nameOf(k.from_user)}</strong> reconoció a <strong>{nameOf(k.to_user)}</strong>
                    </p>
                    {k.message && <p className="text-sm text-muted">«{k.message}»</p>}
                    <p className="mt-0.5 text-xs text-muted">{fmtWhen(k.created)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
