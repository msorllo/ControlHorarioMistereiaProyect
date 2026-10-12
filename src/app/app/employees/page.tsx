"use client";

import { useCallback, useEffect, useState } from "react";
import { getPB } from "@/lib/pb";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";
import { ROLES, type Role } from "@/config/roles";

interface Employee {
  id: string;
  name: string;
  email: string;
  role: Role;
  job_title?: string;
  active: boolean;
  hourly_rate?: number;
}

export default function EmployeesPage() {
  const { user, business } = useAuth();
  const pb = getPB();
  const [list, setList] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Formulario de alta
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "employee" as Role, job_title: "", hourly_rate: "" });

  const canManage = user?.role === "owner" || user?.role === "manager";
  const isOwner = user?.role === "owner";

  const load = useCallback(async () => {
    if (!business) return;
    const items = await pb.collection("users").getFullList<Employee>({
      filter: `business="${business.id}"`,
      sort: "name",
    });
    setList(items);
    setLoading(false);
  }, [pb, business]);

  useEffect(() => {
    load();
  }, [load]);

  async function createEmployee(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await apiFetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Error");
      setForm({ name: "", email: "", password: "", role: "employee", job_title: "", hourly_rate: "" });
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el empleado");
    } finally {
      setSaving(false);
    }
  }

  async function patchEmployee(id: string, body: Record<string, unknown>) {
    await apiFetch(`/api/employees/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    await load();
  }

  if (!canManage) {
    return <p className="text-muted">No tienes acceso a esta sección.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Empleados</h1>
          <p className="text-muted">Gestiona tu equipo sin salir de la app.</p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded-[var(--radius)] bg-primary px-4 py-2.5 font-semibold text-on-primary transition hover:bg-primary-strong"
        >
          {showForm ? "Cancelar" : "+ Añadir empleado"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={createEmployee} className="grid gap-3 rounded-[var(--radius)] border border-border bg-surface p-5 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-ink">Nombre</span>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="rounded-[var(--radius)] border border-border bg-canvas px-3 py-2 text-ink outline-none focus:border-primary" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-ink">Correo</span>
            <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="rounded-[var(--radius)] border border-border bg-canvas px-3 py-2 text-ink outline-none focus:border-primary" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-ink">Contraseña (mín. 8)</span>
            <input required type="text" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="rounded-[var(--radius)] border border-border bg-canvas px-3 py-2 text-ink outline-none focus:border-primary" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-ink">Puesto</span>
            <input value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })}
              placeholder="p. ej. Dependiente"
              className="rounded-[var(--radius)] border border-border bg-canvas px-3 py-2 text-ink outline-none focus:border-primary" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-ink">Tarifa (€/h)</span>
            <input type="number" min={0} step="0.5" value={form.hourly_rate} onChange={(e) => setForm({ ...form, hourly_rate: e.target.value })}
              placeholder="p. ej. 12"
              className="rounded-[var(--radius)] border border-border bg-canvas px-3 py-2 text-ink outline-none focus:border-primary" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-ink">Rol</span>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
              className="rounded-[var(--radius)] border border-border bg-canvas px-3 py-2 text-ink outline-none focus:border-primary">
              <option value="employee">Empleado</option>
              {isOwner && <option value="manager">Responsable</option>}
            </select>
          </label>
          <div className="flex items-end">
            <button disabled={saving} type="submit"
              className="w-full rounded-[var(--radius)] bg-primary px-4 py-2 font-semibold text-on-primary transition hover:bg-primary-strong disabled:opacity-60">
              {saving ? "Guardando…" : "Crear empleado"}
            </button>
          </div>
          {error && <p className="sm:col-span-2 rounded-[var(--radius)] border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        </form>
      )}

      <div className="overflow-hidden rounded-[var(--radius)] border border-border bg-surface">
        {loading ? (
          <p className="p-5 text-muted">Cargando equipo…</p>
        ) : list.length === 0 ? (
          <p className="p-5 text-muted">Todavía no hay empleados. Añade el primero.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">Correo</th>
                <th className="px-4 py-3 font-medium">Rol</th>
                <th className="px-4 py-3 font-medium">€/h</th>
                <th className="px-4 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {list.map((emp) => (
                <tr key={emp.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink">{emp.name}</p>
                    {emp.job_title && <p className="text-xs text-muted">{emp.job_title}</p>}
                  </td>
                  <td className="hidden px-4 py-3 text-muted sm:table-cell">{emp.email}</td>
                  <td className="px-4 py-3">
                    {isOwner && emp.id !== user?.id && emp.role !== "owner" ? (
                      <select
                        value={emp.role}
                        onChange={(e) => patchEmployee(emp.id, { role: e.target.value })}
                        className="rounded-md border border-border bg-canvas px-2 py-1 text-ink outline-none focus:border-primary"
                      >
                        <option value="employee">Empleado</option>
                        <option value="manager">Responsable</option>
                      </select>
                    ) : (
                      <span className="text-ink">{ROLES[emp.role].name}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isOwner ? (
                      <input
                        type="number"
                        min={0}
                        step="0.5"
                        defaultValue={emp.hourly_rate ?? ""}
                        onBlur={(e) => {
                          const v = Number(e.target.value) || 0;
                          if (v !== (emp.hourly_rate ?? 0)) patchEmployee(emp.id, { hourly_rate: v });
                        }}
                        className="w-20 rounded-md border border-border bg-canvas px-2 py-1 text-ink outline-none focus:border-primary"
                      />
                    ) : (
                      <span className="text-muted">{emp.hourly_rate ? `${emp.hourly_rate} €` : "—"}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {emp.id === user?.id ? (
                      <span className="text-xs text-muted">Tú</span>
                    ) : (
                      <button
                        onClick={() => patchEmployee(emp.id, { active: !emp.active })}
                        className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                          emp.active
                            ? "bg-success/15 text-success hover:bg-success/25"
                            : "bg-surface2 text-muted hover:bg-border"
                        }`}
                      >
                        {emp.active ? "Activo" : "Inactivo"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
