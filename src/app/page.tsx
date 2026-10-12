import HealthCheck from "@/components/HealthCheck";
import { MODULES } from "@/config/modules";
import { ROLES, type Role } from "@/config/roles";

const PHASES = [
  {
    n: "0",
    title: "Cimientos",
    state: "En curso",
    tone: "primary" as const,
    items: [
      "Next.js PWA + Tailwind",
      "PocketBase · 1 archivo por negocio",
      "Sistema de temas y módulos",
      "Roles del sistema",
    ],
  },
  {
    n: "1",
    title: "Base sólida",
    state: "Siguiente",
    tone: "accent" as const,
    items: [
      "Login con interfaz según rol",
      "Fichaje de 1 toque + historial",
      "Panel de administración no-code",
      "Chat de equipo en tiempo real",
    ],
  },
  {
    n: "2",
    title: "Inteligencia",
    state: "Planificado",
    tone: "muted" as const,
    items: [
      "Asistente IA que entiende intenciones",
      "Fichaje por ubicación (geofencing)",
      "Cuadrantes automáticos",
      "Alertas anti-burnout",
    ],
  },
];

const ROLE_ORDER: Role[] = ["superadmin", "owner", "manager", "employee"];

export default function Home() {
  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      {/* Resplandor de marca de fondo */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-40 h-96 opacity-60 blur-3xl"
        style={{
          background:
            "radial-gradient(600px 300px at 30% 0%, color-mix(in srgb, var(--brand-primary) 35%, transparent), transparent), radial-gradient(500px 260px at 80% 10%, color-mix(in srgb, var(--brand-accent) 28%, transparent), transparent)",
        }}
      />

      {/* Barra superior */}
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="Mistereia" width={36} height={36} className="rounded-xl" />
          <div className="leading-tight">
            <p className="font-display text-lg font-bold text-ink">Mistereia</p>
            <p className="text-xs text-muted">Control Horario</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/login"
            className="rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-ink transition hover:border-primary"
          >
            Entrar
          </a>
          <a
            href="/signup"
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition hover:bg-primary-strong"
          >
            Crear negocio gratis
          </a>
        </div>
      </header>

      {/* Héroe */}
      <main className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-6 pb-20">
        <section className="grid items-start gap-10 py-10 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="flex flex-col gap-6">
            <span className="w-fit rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              Del caos horario a la claridad total
            </span>
            <h1 className="font-display text-4xl font-extrabold leading-tight tracking-tight text-ink sm:text-5xl">
              El control horario que{" "}
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: "linear-gradient(90deg, var(--brand-primary), var(--brand-accent))" }}
              >
                se adapta a tu negocio
              </span>
              , no al revés.
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-muted">
              Fichaje inteligente, turnos, chat de equipo estilo WhatsApp e IA que ahorra tiempo.
              Ultrapersonalizable para cualquier negocio y con tu base de datos{" "}
              <strong className="text-ink">privada, gratis y en un solo archivo</strong>.
            </p>
            <div className="flex flex-wrap gap-3">
              <span className="rounded-full border border-border bg-surface px-4 py-2 text-sm text-ink">📱 PWA móvil y PC</span>
              <span className="rounded-full border border-border bg-surface px-4 py-2 text-sm text-ink">🗄️ 1 base de datos por negocio</span>
              <span className="rounded-full border border-border bg-surface px-4 py-2 text-sm text-ink">🧩 Módulos a la carta</span>
            </div>
          </div>

          {/* Estado del sistema */}
          <div className="flex flex-col gap-4 rounded-[calc(var(--radius)+4px)] border border-border bg-surface p-6 shadow-sm">
            <p className="font-display text-sm font-semibold uppercase tracking-wide text-muted">
              Estado de los cimientos
            </p>
            <HealthCheck />
            <ul className="flex flex-col gap-2 text-sm text-ink">
              <li className="flex items-center gap-2"><span className="text-success">✔</span> Next.js 16 + Tailwind listos</li>
              <li className="flex items-center gap-2"><span className="text-success">✔</span> PocketBase v0.39 instalado</li>
              <li className="flex items-center gap-2"><span className="text-success">✔</span> Temas, módulos y roles definidos</li>
            </ul>
          </div>
        </section>

        {/* Roadmap por fases */}
        <section className="mt-6">
          <h2 className="font-display text-2xl font-bold text-ink">Hoja de ruta</h2>
          <p className="mt-1 text-muted">Construimos por capas: primero lo esencial funcionando, luego la inteligencia.</p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {PHASES.map((p) => (
              <div key={p.n} className="flex flex-col gap-3 rounded-[var(--radius)] border border-border bg-surface p-5">
                <div className="flex items-center justify-between">
                  <span className="font-display text-3xl font-extrabold text-muted/40">{p.n}</span>
                  <span
                    className="rounded-full px-2.5 py-1 text-xs font-semibold"
                    style={{
                      color:
                        p.tone === "primary" ? "var(--brand-primary)" : p.tone === "accent" ? "var(--brand-accent)" : "var(--text-muted)",
                      backgroundColor:
                        p.tone === "primary"
                          ? "color-mix(in srgb, var(--brand-primary) 12%, transparent)"
                          : p.tone === "accent"
                            ? "color-mix(in srgb, var(--brand-accent) 12%, transparent)"
                            : "var(--surface-2)",
                    }}
                  >
                    {p.state}
                  </span>
                </div>
                <h3 className="font-display text-lg font-bold text-ink">{p.title}</h3>
                <ul className="flex flex-col gap-1.5 text-sm text-muted">
                  {p.items.map((it) => (
                    <li key={it} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      {it}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Módulos activables */}
        <section className="mt-12">
          <h2 className="font-display text-2xl font-bold text-ink">Módulos a la carta</h2>
          <p className="mt-1 text-muted">
            Cada negocio enciende solo lo que necesita. Una panadería y una agencia usan la misma app con piezas distintas.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {MODULES.map((m) => (
              <div key={m.id} className="flex items-start gap-3 rounded-[var(--radius)] border border-border bg-surface p-4">
                <span className="text-2xl">{m.icon}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-ink">{m.name}</p>
                    <span className="rounded-full bg-surface2 px-2 py-0.5 text-[10px] font-medium text-muted">Fase {m.phase}</span>
                  </div>
                  <p className="mt-0.5 text-sm text-muted">{m.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Roles */}
        <section className="mt-12">
          <h2 className="font-display text-2xl font-bold text-ink">Roles con interfaz adaptativa</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {ROLE_ORDER.map((r) => (
              <div key={r} className="rounded-[var(--radius)] border border-border bg-surface p-4">
                <p className="font-display font-bold text-ink">{ROLES[r].name}</p>
                <p className="mt-1 text-sm text-muted">{ROLES[r].description}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="relative z-10 mx-auto w-full max-w-6xl px-6 py-8 text-sm text-muted">
        Control Horario Mistereia · Cimientos listos · Siguiente: login, fichaje y panel de administración.
      </footer>
    </div>
  );
}
