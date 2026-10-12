"use client";

import { useCallback, useEffect, useState } from "react";
import { getPB } from "@/lib/pb";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";

interface BizRow {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  created: string;
  employees: number;
  activeEmployees: number;
  modulesOn: number;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

export default function BusinessesPage() {
  const { user } = useAuth();
  const pb = getPB();
  const [list, setList] = useState<BizRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await apiFetch("/api/businesses");
    if (res.ok) {
      const data = await res.json();
      setList(data.businesses ?? []);
    }
    setLoading(false);
  }, [pb]);

  useEffect(() => {
    load();
  }, [load]);

  if (user?.role !== "superadmin") {
    return <p className="text-muted">Esta sección es solo para el Super Administrador de la plataforma.</p>;
  }

  const totalEmployees = list.reduce((a, b) => a + b.employees, 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Negocios de la plataforma</h1>
        <p className="text-muted">Todos los negocios dados de alta en Mistereia.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-[var(--radius)] border border-border bg-surface p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Negocios</p>
          <p className="font-display text-2xl font-bold text-ink">{list.length}</p>
        </div>
        <div className="rounded-[var(--radius)] border border-border bg-surface p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Empleados totales</p>
          <p className="font-display text-2xl font-bold text-ink">{totalEmployees}</p>
        </div>
        <div className="rounded-[var(--radius)] border border-border bg-surface p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Activos</p>
          <p className="font-display text-2xl font-bold text-success">{list.filter((b) => b.active).length}</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-[var(--radius)] border border-border bg-surface">
        {loading ? (
          <p className="p-5 text-muted">Cargando…</p>
        ) : list.length === 0 ? (
          <p className="p-5 text-muted">No hay negocios todavía.</p>
        ) : (
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="px-4 py-3 font-medium">Negocio</th>
                <th className="px-4 py-3 font-medium">Empleados</th>
                <th className="px-4 py-3 font-medium">Módulos</th>
                <th className="px-4 py-3 font-medium">Alta</th>
                <th className="px-4 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {list.map((b) => (
                <tr key={b.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink">{b.name}</p>
                    <p className="text-xs text-muted">/{b.slug}</p>
                  </td>
                  <td className="px-4 py-3 text-ink">{b.activeEmployees} / {b.employees}</td>
                  <td className="px-4 py-3 text-muted">{b.modulesOn} activos</td>
                  <td className="px-4 py-3 text-muted">{fmtDate(b.created)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${b.active ? "bg-success/15 text-success" : "bg-surface2 text-muted"}`}>
                      {b.active ? "Activo" : "Inactivo"}
                    </span>
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
