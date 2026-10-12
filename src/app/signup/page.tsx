"use client";

import { apiFetch } from "@/lib/api";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/providers/AuthProvider";

export default function SignupPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [businessName, setBusinessName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Precarga el panel para que, al entrar, abra al instante.
  useEffect(() => {
    router.prefetch("/app");
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await apiFetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessName, name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "No se pudo crear la cuenta");
      // Alta correcta → iniciamos sesión con el dueño recién creado.
      await login(email, password);
      router.replace("/app");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la cuenta");
      setBusy(false);
    }
  }

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden px-6 py-12">
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
          <h1 className="font-display text-2xl font-bold text-ink">Crea tu negocio gratis</h1>
          <p className="mt-1 text-sm text-muted">En un minuto tienes tu control horario listo. Sin tarjeta.</p>

          <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink">Nombre del negocio</span>
              <input required value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="p. ej. Panadería La Espiga"
                className="rounded-[var(--radius)] border border-border bg-canvas px-4 py-2.5 text-ink outline-none transition focus:border-primary" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink">Tu nombre</span>
              <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre y apellido"
                className="rounded-[var(--radius)] border border-border bg-canvas px-4 py-2.5 text-ink outline-none transition focus:border-primary" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink">Correo electrónico</span>
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@negocio.com"
                className="rounded-[var(--radius)] border border-border bg-canvas px-4 py-2.5 text-ink outline-none transition focus:border-primary" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink">Contraseña (mín. 8)</span>
              <input required type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                className="rounded-[var(--radius)] border border-border bg-canvas px-4 py-2.5 text-ink outline-none transition focus:border-primary" />
            </label>

            {error && (
              <p className="rounded-[var(--radius)] border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
            )}

            <button type="submit" disabled={busy}
              className="mt-1 rounded-[var(--radius)] bg-primary px-4 py-2.5 font-semibold text-on-primary transition hover:bg-primary-strong disabled:opacity-60">
              {busy ? "Creando tu negocio…" : "Crear mi negocio"}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-muted">
            ¿Ya tienes cuenta?{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">Entrar</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
