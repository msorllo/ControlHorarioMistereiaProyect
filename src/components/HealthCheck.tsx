"use client";

import { useEffect, useState } from "react";
import { PB_URL } from "@/lib/pb";
import { IS_DEMO } from "@/lib/demo";

type Status = "checking" | "ok" | "down";

const LABEL: Record<Status, string> = {
  checking: "Comprobando conexión…",
  ok: "Base de datos conectada",
  down: "PocketBase no responde",
};

/**
 * Comprueba en vivo si el backend PocketBase está accesible.
 * Sirve como "señal de vida" de los cimientos del proyecto.
 */
export default function HealthCheck() {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    if (IS_DEMO) return; // la demo no tiene servidor que comprobar
    let alive = true;
    fetch(`${PB_URL}/api/health`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(() => alive && setStatus("ok"))
      .catch(() => alive && setStatus("down"));
    return () => {
      alive = false;
    };
  }, []);

  const color =
    status === "ok" ? "var(--success)" : status === "down" ? "var(--danger)" : "var(--warning)";

  if (IS_DEMO) {
    return (
      <div className="flex flex-col gap-2 rounded-[var(--radius)] border border-border bg-surface2 p-5">
        <span className="font-medium text-ink">Demo pública · sin servidor</span>
        <p className="text-sm text-muted">Tus datos se guardan solo en tu navegador. Nadie más puede verlos y puedes restablecerlos cuando quieras.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius)] border border-border bg-surface2 p-5">
      <div className="flex items-center gap-3">
        <span className="relative flex h-3 w-3">
          {status === "checking" && (
            <span
              className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
              style={{ backgroundColor: color }}
            />
          )}
          <span className="relative inline-flex h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
        </span>
        <span className="font-medium text-ink">{LABEL[status]}</span>
      </div>
      <p className="text-sm text-muted">
        {status === "ok" && (
          <>
            Panel de administración:{" "}
            <a
              href={`${PB_URL}/_/`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              {PB_URL}/_/
            </a>
          </>
        )}
        {status === "down" && (
          <>
            Arranca el backend con{" "}
            <code className="rounded bg-canvas px-1.5 py-0.5 text-xs">pocketbase serve</code> dentro de la
            carpeta <code className="rounded bg-canvas px-1.5 py-0.5 text-xs">/pocketbase</code>.
          </>
        )}
        {status === "checking" && <>Contactando con {PB_URL}…</>}
      </p>
    </div>
  );
}
