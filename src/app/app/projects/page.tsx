"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getPB } from "@/lib/pb";
import { useAuth } from "@/providers/AuthProvider";
import { sessionsWithProject, type SessionEntry } from "@/lib/sessions";

interface Project {
  id: string;
  name: string;
  client?: string;
  color?: string;
  active: boolean;
  status?: string;
  icon?: string;
  description?: string;
  budget_hours?: number;
  billing_rate?: number;
  deadline?: string;
}
interface UserLite {
  id: string;
  name: string;
  hourly_rate?: number;
}
interface Form {
  name: string;
  client: string;
  icon: string;
  color: string;
  status: string;
  budget_hours: string;
  billing_rate: string;
  deadline: string;
  description: string;
}

const COLORS = ["#7c5cff", "#22d3ee", "#16a34a", "#f59e0b", "#e11d48", "#3b82f6", "#a855f7", "#14b8a6"];
const ICONS = ["📁", "🔨", "🎨", "💻", "🏠", "🚗", "🍽️", "📦", "🌱", "🛠️", "📸", "🎬"];
const EMPTY: Form = { name: "", client: "", icon: "📁", color: COLORS[0], status: "en_curso", budget_hours: "", billing_rate: "", deadline: "", description: "" };

const STATUS_META: Record<string, { label: string; color: string }> = {
  en_curso: { label: "En curso", color: "var(--success)" },
  pausado: { label: "En pausa", color: "var(--warning)" },
  terminado: { label: "Terminado", color: "var(--text-muted)" },
};

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}
const eur = (n: number) => n.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 1 });

function ProjectFields({ value, onChange }: { value: Form; onChange: (f: Form) => void }) {
  const set = (patch: Partial<Form>) => onChange({ ...value, ...patch });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink">Nombre del proyecto</span>
        <input value={value.name} onChange={(e) => set({ name: e.target.value })} placeholder="p. ej. Reforma cocina" className="rounded-[var(--radius)] border border-border bg-canvas px-3 py-2 text-ink outline-none focus:border-primary" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink">Cliente</span>
        <input value={value.client} onChange={(e) => set({ client: e.target.value })} placeholder="p. ej. Familia García" className="rounded-[var(--radius)] border border-border bg-canvas px-3 py-2 text-ink outline-none focus:border-primary" />
      </label>
      <div className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink">Icono</span>
        <div className="flex flex-wrap gap-1">
          {ICONS.map((ic) => (
            <button key={ic} type="button" onClick={() => set({ icon: ic })} className={`flex h-8 w-8 items-center justify-center rounded-md text-base transition ${value.icon === ic ? "bg-primary/15 ring-2 ring-primary" : "bg-surface2 hover:bg-border"}`}>{ic}</button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink">Color</span>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {COLORS.map((c) => (
            <button key={c} type="button" onClick={() => set({ color: c })} aria-label={c} className="h-6 w-6 rounded-full transition" style={{ backgroundColor: c, boxShadow: value.color === c ? `0 0 0 2px ${c}` : undefined }} />
          ))}
        </div>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink">Estado</span>
        <select value={value.status} onChange={(e) => set({ status: e.target.value })} className="rounded-[var(--radius)] border border-border bg-canvas px-3 py-2 text-ink outline-none focus:border-primary">
          <option value="en_curso">En curso</option>
          <option value="pausado">En pausa</option>
          <option value="terminado">Terminado</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink">Fecha límite</span>
        <input type="date" value={value.deadline} onChange={(e) => set({ deadline: e.target.value })} className="rounded-[var(--radius)] border border-border bg-canvas px-3 py-2 text-ink outline-none focus:border-primary" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink">Presupuesto de horas</span>
        <input type="number" min={0} value={value.budget_hours} onChange={(e) => set({ budget_hours: e.target.value })} placeholder="p. ej. 80" className="rounded-[var(--radius)] border border-border bg-canvas px-3 py-2 text-ink outline-none focus:border-primary" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink">Tarifa al cliente (€/h)</span>
        <input type="number" min={0} step="0.5" value={value.billing_rate} onChange={(e) => set({ billing_rate: e.target.value })} placeholder="p. ej. 35" className="rounded-[var(--radius)] border border-border bg-canvas px-3 py-2 text-ink outline-none focus:border-primary" />
      </label>
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        <span className="font-medium text-ink">Descripción / notas</span>
        <textarea value={value.description} onChange={(e) => set({ description: e.target.value })} rows={2} placeholder="Detalles del proyecto…" className="rounded-[var(--radius)] border border-border bg-canvas px-3 py-2 text-ink outline-none focus:border-primary" />
      </label>
    </div>
  );
}

export default function ProjectsPage() {
  const { user, business } = useAuth();
  const pb = getPB();
  const canManage = user?.role === "owner" || user?.role === "manager";

  const [list, setList] = useState<Project[]>([]);
  const [entries, setEntries] = useState<SessionEntry[]>([]);
  const [users, setUsers] = useState<UserLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Form>(EMPTY);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!business) return;
    const since = new Date(Date.now() - 180 * 86_400_000).toISOString();
    const [items, ent, ppl] = await Promise.all([
      pb.collection("projects").getFullList<Project>({ filter: `business="${business.id}"`, sort: "name" }),
      pb.collection("time_entries").getFullList<SessionEntry>({ filter: `business="${business.id}" && at>="${since}"`, sort: "at" }),
      pb.collection("users").getFullList<UserLite>({ filter: `business="${business.id}"`, sort: "name" }),
    ]);
    // Ordena por estado (en curso primero) y luego nombre.
    const order: Record<string, number> = { en_curso: 0, pausado: 1, terminado: 2 };
    items.sort((a, b) => (order[a.status ?? "en_curso"] - order[b.status ?? "en_curso"]) || a.name.localeCompare(b.name));
    setList(items);
    setEntries(ent);
    setUsers(ppl);
    setLoading(false);
  }, [pb, business]);

  useEffect(() => {
    load();
  }, [load]);

  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  // Horas por (proyecto, empleado) a partir de las sesiones trabajadas.
  const detail = useMemo(() => {
    const byUser = new Map<string, SessionEntry[]>();
    for (const e of entries) {
      const u = e.user ?? "_";
      (byUser.get(u) ?? byUser.set(u, []).get(u)!).push(e);
    }
    const map = new Map<string, Map<string, number>>(); // project -> user -> horas
    for (const [uid, es] of byUser) {
      for (const s of sessionsWithProject(es)) {
        const pm = map.get(s.project) ?? new Map<string, number>();
        pm.set(uid, (pm.get(uid) ?? 0) + s.minutes / 60);
        map.set(s.project, pm);
      }
    }
    return map;
  }, [entries]);

  const usedHours = useMemo(() => {
    const m = new Map<string, number>();
    for (const [pid, um] of detail) m.set(pid, [...um.values()].reduce((a, b) => a + b, 0));
    return m;
  }, [detail]);

  function toPayload(f: Form) {
    return {
      name: f.name.trim(),
      client: f.client.trim(),
      icon: f.icon,
      color: f.color,
      status: f.status,
      active: f.status === "en_curso",
      description: f.description.trim(),
      budget_hours: Number(f.budget_hours) || 0,
      billing_rate: Number(f.billing_rate) || 0,
      deadline: f.deadline || "",
    };
  }
  function formOf(p: Project): Form {
    return {
      name: p.name, client: p.client ?? "", icon: p.icon ?? "📁", color: p.color ?? COLORS[0], status: p.status ?? (p.active ? "en_curso" : "terminado"),
      budget_hours: p.budget_hours ? String(p.budget_hours) : "", billing_rate: p.billing_rate ? String(p.billing_rate) : "",
      deadline: p.deadline ?? "", description: p.description ?? "",
    };
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!business || !form.name.trim()) return;
    setSaving(true);
    try {
      await pb.collection("projects").create({ business: business.id, created_by: user?.id, ...toPayload(form) });
      setForm(EMPTY);
      setShowCreate(false);
      await load();
    } finally {
      setSaving(false);
    }
  }
  async function saveEdit() {
    if (!editingId) return;
    setSaving(true);
    try {
      await pb.collection("projects").update(editingId, toPayload(editForm));
      setEditingId(null);
      await load();
    } finally {
      setSaving(false);
    }
  }
  async function changeStatus(p: Project, status: string) {
    await pb.collection("projects").update(p.id, { status, active: status === "en_curso" });
    await load();
  }
  async function remove(id: string) {
    await pb.collection("projects").delete(id);
    await load();
  }

  const today = ymd(new Date());
  if (!canManage) return <p className="text-muted">No tienes acceso a esta sección.</p>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Proyectos y clientes</h1>
          <p className="text-muted">Imputa horas, controla presupuestos y mide la rentabilidad de cada cliente.</p>
        </div>
        <button onClick={() => setShowCreate((s) => !s)} className="rounded-[var(--radius)] bg-primary px-4 py-2.5 font-semibold text-on-primary transition hover:bg-primary-strong">
          {showCreate ? "Cancelar" : "+ Nuevo proyecto"}
        </button>
      </div>

      {showCreate && (
        <form onSubmit={create} className="flex flex-col gap-4 rounded-[var(--radius)] border border-border bg-surface p-5">
          <ProjectFields value={form} onChange={setForm} />
          <div>
            <button type="submit" disabled={saving} className="rounded-[var(--radius)] bg-primary px-4 py-2 font-semibold text-on-primary transition hover:bg-primary-strong disabled:opacity-60">
              {saving ? "Guardando…" : "Crear proyecto"}
            </button>
          </div>
        </form>
      )}

      <div className="flex flex-col gap-3">
        {loading ? (
          <p className="text-muted">Cargando…</p>
        ) : list.length === 0 ? (
          <p className="rounded-[var(--radius)] border border-border bg-surface p-5 text-muted">Aún no hay proyectos. Crea el primero.</p>
        ) : (
          list.map((p) => {
            const st = STATUS_META[p.status ?? "en_curso"] ?? STATUS_META.en_curso;
            const used = usedHours.get(p.id) ?? 0;
            const budget = p.budget_hours ?? 0;
            const pct = budget > 0 ? Math.min(100, (used / budget) * 100) : 0;
            const over = budget > 0 && used > budget;
            const overdue = p.deadline && p.deadline < today && p.status === "en_curso";
            const billed = used * (p.billing_rate ?? 0);
            const perUser = detail.get(p.id);
            const meaningful = perUser ? [...perUser.entries()].filter(([, h]) => h > 0.01).sort((a, b) => b[1] - a[1]) : [];
            return (
              <div key={p.id} className="rounded-[var(--radius)] border border-border bg-surface p-4">
                {editingId === p.id ? (
                  <div className="flex flex-col gap-4">
                    <ProjectFields value={editForm} onChange={setEditForm} />
                    <div className="flex gap-2">
                      <button onClick={saveEdit} disabled={saving} className="rounded-[var(--radius)] bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition hover:bg-primary-strong disabled:opacity-60">Guardar</button>
                      <button onClick={() => setEditingId(null)} className="rounded-[var(--radius)] border border-border bg-surface px-4 py-2 text-sm text-ink">Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xl" style={{ backgroundColor: `color-mix(in srgb, ${p.color ?? "#7c5cff"} 18%, transparent)` }}>{p.icon ?? "📁"}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color ?? "#7c5cff" }} />
                          <p className="font-display font-bold text-ink">{p.name}</p>
                          <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ color: st.color, backgroundColor: `color-mix(in srgb, ${st.color} 14%, transparent)` }}>{st.label}</span>
                          {p.deadline && (
                            <span className={`rounded-full px-2 py-0.5 text-xs ${overdue ? "bg-danger/15 text-danger" : "bg-surface2 text-muted"}`}>{overdue ? "Vencido" : "📅"} {p.deadline}</span>
                          )}
                        </div>
                        {p.client && <p className="text-sm text-muted">{p.client}</p>}
                        {p.description && <p className="mt-0.5 text-sm text-muted">{p.description}</p>}
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        <select value={p.status ?? "en_curso"} onChange={(e) => changeStatus(p, e.target.value)} className="rounded-full border border-border bg-surface px-2 py-1 text-xs text-ink outline-none focus:border-primary">
                          <option value="en_curso">En curso</option>
                          <option value="pausado">En pausa</option>
                          <option value="terminado">Terminado</option>
                        </select>
                        <button onClick={() => { setEditingId(p.id); setEditForm(formOf(p)); }} className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-ink transition hover:border-primary">Editar</button>
                        <button onClick={() => remove(p.id)} className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-ink transition hover:border-danger hover:text-danger">Borrar</button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      <div className="min-w-[200px] flex-1">
                        <div className="flex items-center justify-between text-xs text-muted">
                          <span>{eur(used)} h {budget > 0 ? `de ${eur(budget)} h` : "imputadas"}</span>
                          {budget > 0 && <span className={over ? "text-danger" : "text-muted"}>{over ? "Excedido" : `${Math.round(pct)}%`}</span>}
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface2">
                          <div className="h-full rounded-full transition-all" style={{ width: budget > 0 ? `${pct}%` : "0%", backgroundColor: over ? "var(--danger)" : p.color ?? "var(--brand-primary)" }} />
                        </div>
                      </div>
                      {(p.billing_rate ?? 0) > 0 && (
                        <div className="text-right">
                          <p className="font-display font-bold text-ink">{eur(billed)} €</p>
                          <p className="text-xs text-muted">facturable ({eur(p.billing_rate ?? 0)} €/h)</p>
                        </div>
                      )}
                      {meaningful.length > 0 && (
                        <button onClick={() => setExpandedId(expandedId === p.id ? null : p.id)} className="rounded-full border border-border bg-surface2 px-3 py-1 text-xs text-ink transition hover:border-primary">
                          {expandedId === p.id ? "Ocultar reparto" : `Ver reparto (${meaningful.length})`}
                        </button>
                      )}
                    </div>

                    {/* Reparto por empleado */}
                    {expandedId === p.id && meaningful.length > 0 && (
                      <div className="mt-1 overflow-hidden rounded-[var(--radius)] border border-border">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border text-left text-muted">
                              <th className="px-3 py-2 font-medium">Empleado</th>
                              <th className="px-3 py-2 font-medium">Horas</th>
                              <th className="px-3 py-2 text-right font-medium">Coste</th>
                            </tr>
                          </thead>
                          <tbody>
                            {meaningful.map(([uid, hrs]) => {
                              const u = userMap.get(uid);
                              const cost = hrs * (u?.hourly_rate ?? 0);
                              return (
                                <tr key={uid} className="border-b border-border/60 last:border-0">
                                  <td className="px-3 py-2 text-ink">{u?.name ?? "Empleado"}</td>
                                  <td className="px-3 py-2 text-ink">{eur(hrs)} h</td>
                                  <td className="px-3 py-2 text-right text-ink">{eur(cost)} €</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
