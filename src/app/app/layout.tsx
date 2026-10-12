"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/providers/AuthProvider";
import DemoBanner from "@/components/DemoBanner";
import { applyBrand, clearBrand } from "@/lib/theme";
import { ROLES, type Role } from "@/config/roles";
import type { ModuleId } from "@/config/modules";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  roles: Role[];
  /** Si se indica, solo aparece cuando el negocio tiene ese módulo activado. */
  module?: ModuleId;
  soon?: boolean;
}

const NAV: NavItem[] = [
  { href: "/app", label: "Fichaje", icon: "⏱️", roles: ["employee", "manager", "owner"] },
  { href: "/app/assistant", label: "Asistente", icon: "🤖", roles: ["employee", "manager", "owner"], module: "ai_assistant" },
  { href: "/app/chat", label: "Chat", icon: "💬", roles: ["employee", "manager", "owner"], module: "chat" },
  { href: "/app/board", label: "Tablón", icon: "📣", roles: ["employee", "manager", "owner"], module: "announcements" },
  { href: "/app/shifts", label: "Turnos", icon: "📅", roles: ["employee", "manager", "owner"], module: "shifts" },
  { href: "/app/history", label: "Mi historial", icon: "📜", roles: ["employee", "manager", "owner"] },
  { href: "/app/documents", label: "Documentos", icon: "📁", roles: ["employee", "manager", "owner"], module: "documents" },
  { href: "/app/rewards", label: "Logros", icon: "🏆", roles: ["employee", "manager", "owner"], module: "gamification" },
  { href: "/app/team", label: "Equipo", icon: "👥", roles: ["manager", "owner"] },
  { href: "/app/burnout", label: "Bienestar", icon: "😌", roles: ["manager", "owner"], module: "burnout" },
  { href: "/app/employees", label: "Empleados", icon: "🧑‍💼", roles: ["manager", "owner"] },
  { href: "/app/projects", label: "Proyectos", icon: "🗂️", roles: ["manager", "owner"], module: "projects" },
  { href: "/app/reports", label: "Informes", icon: "📊", roles: ["manager", "owner"], module: "payroll_export" },
  { href: "/app/settings", label: "Configuración", icon: "⚙️", roles: ["owner"] },
  { href: "/app/businesses", label: "Negocios", icon: "🏢", roles: ["superadmin"] },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, business, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Guardia: sin sesión → al login. SuperAdmin → su panel de negocios.
  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.role === "superadmin" && pathname === "/app") router.replace("/app/businesses");
  }, [loading, user, router, pathname]);

  // Aplica el tema del negocio (marca blanca) sobreescribiendo los tokens.
  useEffect(() => {
    applyBrand(business?.theme?.primary, business?.theme?.accent);
    return clearBrand;
  }, [business]);

  if (loading || !user) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted">Cargando tu espacio…</div>
    );
  }

  const role = user.role as Role;
  const items = NAV.filter(
    (n) => n.roles.includes(role) && (!n.module || business?.modules?.[n.module] !== false),
  );

  return (
    <div className="flex flex-1 flex-col">
      <DemoBanner />
      {/* Barra superior */}
      <header className="sticky top-0 z-20 border-b border-border bg-surface/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="" width={30} height={30} className="rounded-lg" />
            <div className="leading-tight">
              <p className="font-display text-sm font-bold text-ink">{business?.name ?? "Mistereia"}</p>
              <p className="text-xs text-muted">Control Horario</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-ink">{user.name}</p>
              <p className="text-xs text-muted">{ROLES[role].name}</p>
            </div>
            <button
              onClick={logout}
              className="rounded-full border border-border bg-surface2 px-3 py-1.5 text-sm text-ink transition hover:border-danger hover:text-danger"
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-6 px-4 py-6">
        {/* Navegación lateral (según rol) */}
        <nav className="hidden w-56 shrink-0 flex-col gap-1 md:flex">
          {items.map((n) => {
            const active = pathname === n.href;
            const base =
              "flex items-center justify-between gap-2 rounded-[var(--radius)] px-3 py-2.5 text-sm transition";
            if (n.soon) {
              return (
                <span key={n.href} className={`${base} cursor-default text-muted/70`}>
                  <span className="flex items-center gap-2">
                    <span>{n.icon}</span>
                    {n.label}
                  </span>
                  <span className="rounded-full bg-surface2 px-1.5 py-0.5 text-[10px]">Pronto</span>
                </span>
              );
            }
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`${base} ${
                  active ? "bg-primary/12 font-semibold text-primary" : "text-ink hover:bg-surface2"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span>{n.icon}</span>
                  {n.label}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Contenido */}
        <main className="min-w-0 flex-1">{children}</main>
      </div>

      {/* Navegación inferior (móvil) */}
      <nav className="sticky bottom-0 z-20 flex items-center justify-around border-t border-border bg-surface/90 px-2 py-1.5 backdrop-blur md:hidden">
        {items.slice(0, 5).map((n) => {
          const active = pathname === n.href;
          const inner = (
            <span className="flex flex-col items-center gap-0.5">
              <span className="text-lg">{n.icon}</span>
              <span className="text-[10px]">{n.label}</span>
            </span>
          );
          return n.soon ? (
            <span key={n.href} className="px-2 py-1 text-muted/60">
              {inner}
            </span>
          ) : (
            <Link
              key={n.href}
              href={n.href}
              className={`px-2 py-1 ${active ? "text-primary" : "text-ink"}`}
            >
              {inner}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
