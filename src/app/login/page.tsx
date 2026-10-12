"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/providers/AuthProvider";
import { IS_DEMO } from "@/lib/demo";
import DemoBanner from "@/components/DemoBanner";

const DEMO = [
  { label: "Dueña", email: "dueno@demo.mistereia" },
  { label: "Responsable", email: "responsable@demo.mistereia" },
  { label: "Empleada", email: "empleado@demo.mistereia" },
];

// Las cuentas de ejemplo solo se muestran en la demo pública o en desarrollo local; nunca en un servidor real.
const SHOW_DEMO_ACCOUNTS = IS_DEMO || process.env.NODE_ENV !== "production";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/app");
  }, [user, loading, router]);

  // Precarga el panel para que, al entrar, abra al instante.
  useEffect(() => {
    router.prefetch("/app");
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
      router.replace("/app");
    } catch {
      setError("Correo o contraseña incorrectos. Revisa los datos e inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  function quickFill(demoEmail: string) {
    setEmail(demoEmail);
    setPassword("mistereia123");
  }

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <DemoBanner />
      <div className="relative flex flex-1 items-center justify-center px-6 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(500px 320px at 50% 0%, color-mix(in srgb, var(--brand-primary) 30%, transparent), transparent), radial-gradient(420px 280px at 80% 100%, color-mix(in srgb, var(--brand-accent) 22%, transparent), transparent)",
        }}
      />
      <div className="relative z-10 w-full max-w-md">
        <Link href="/" className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm text-ink transition hover:border-primary">
          <span aria-hidden>←</span> Volver al inicio
        </Link>
        <div className="mb-6 flex items-center justify-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="Mistereia" width={40} height={40} className="rounded-xl" />
          <div>
            <p className="font-display text-lg font-bold text-ink">Mistereia</p>
            <p className="text-xs text-muted">Control Horario</p>
          </div>
        </div>

        <div className="rounded-[calc(var(--radius)+6px)] border border-border bg-surface p-7 shadow-sm">
          <h1 className="font-display text-2xl font-bold text-ink">Entrar</h1>
          <p className="mt-1 text-sm text-muted">Accede a tu espacio de trabajo.</p>

          <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink">Correo electrónico</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@empresa.com"
                className="rounded-[var(--radius)] border border-border bg-canvas px-4 py-2.5 text-ink outline-none transition focus:border-primary"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink">Contraseña</span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="rounded-[var(--radius)] border border-border bg-canvas px-4 py-2.5 text-ink outline-none transition focus:border-primary"
              />
            </label>

            {error && (
              <p className="rounded-[var(--radius)] border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="mt-1 rounded-[var(--radius)] bg-primary px-4 py-2.5 font-semibold text-on-primary transition hover:bg-primary-strong disabled:opacity-60"
            >
              {busy ? "Entrando…" : "Entrar"}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-muted">
            ¿No tienes cuenta?{" "}
            <Link href="/signup" className="font-medium text-primary hover:underline">Crea tu negocio gratis</Link>
          </p>

          {SHOW_DEMO_ACCOUNTS && (
          <div className="mt-6 border-t border-border pt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Accesos de prueba</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {DEMO.map((d) => (
                <button
                  key={d.email}
                  type="button"
                  onClick={() => quickFill(d.email)}
                  className="rounded-full border border-border bg-surface2 px-3 py-1.5 text-sm text-ink transition hover:border-primary"
                >
                  {d.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">Contraseña de demo: mistereia123</p>
          </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
