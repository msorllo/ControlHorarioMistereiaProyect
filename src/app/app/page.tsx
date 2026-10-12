"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getPB } from "@/lib/pb";
import { useAuth } from "@/providers/AuthProvider";
import type { TimeEntryType, CheckinMethod } from "@/lib/types";
import { checkWithinLocations, getCurrentCoords, fmtDistance } from "@/lib/geo";

interface Entry {
  id: string;
  type: TimeEntryType;
  method: string;
  at: string;
}

type WorkState = "out" | "in" | "break";

const TYPE_LABEL: Record<TimeEntryType, string> = {
  in: "Entrada",
  out: "Salida",
  break_start: "Inicio de pausa",
  break_end: "Fin de pausa",
};

const METHOD_LABEL: Record<string, string> = {
  manual: "manual",
  geo: "📍 ubicación",
  qr: "QR",
  nfc: "NFC",
  voice: "voz",
};

function startOfTodayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

function fmtDuration(ms: number) {
  const min = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

function fmtStopwatch(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function computeWorkedMs(entries: Entry[]) {
  let total = 0;
  let open: number | null = null;
  for (const e of entries) {
    const t = new Date(e.at).getTime();
    if (e.type === "in" || e.type === "break_end") open = t;
    else if ((e.type === "out" || e.type === "break_start") && open != null) {
      total += t - open;
      open = null;
    }
  }
  if (open != null) total += Date.now() - open;
  return total;
}

export default function FichajePage() {
  const { user, business } = useAuth();
  const pb = getPB();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [geoMsg, setGeoMsg] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const [projects, setProjects] = useState<{ id: string; name: string; client?: string; icon?: string }[]>([]);
  const [selectedProject, setSelectedProject] = useState("");

  // Geofencing activo solo si el módulo está encendido y hay zonas definidas.
  const geoActive = business?.modules?.geofencing === true && (business?.locations?.length ?? 0) > 0;
  const projectsActive = business?.modules?.projects === true;

  const load = useCallback(async () => {
    if (!user) return;
    const list = await pb.collection("time_entries").getFullList<Entry>({
      filter: `user="${user.id}" && at>="${startOfTodayISO()}"`,
      sort: "at",
    });
    setEntries(list);
    setLoading(false);
  }, [pb, user]);

  useEffect(() => {
    load();
  }, [load]);

  // Carga los proyectos activos del negocio (para imputar el turno).
  useEffect(() => {
    if (!projectsActive || !business) return;
    pb.collection("projects")
      .getFullList<{ id: string; name: string; client?: string; icon?: string }>({ filter: `business="${business.id}" && active=true`, sort: "name" })
      .then(setProjects)
      .catch(() => setProjects([]));
  }, [pb, business, projectsActive]);

  // Reloj para que el tiempo trabajado avance en vivo, segundo a segundo.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);

  const last = entries[entries.length - 1];
  const state: WorkState = !last || last.type === "out" ? "out" : last.type === "break_start" ? "break" : "in";
  const workedMs = useMemo(() => computeWorkedMs(entries), [entries, now]);

  async function ficha(type: TimeEntryType) {
    if (!user || !business) return;
    setBusy(true);
    setGeoMsg(null);

    let method: CheckinMethod = "manual";
    let lat: number | undefined;
    let lng: number | undefined;

    if (geoActive) {
      setGeoMsg({ tone: "info", text: "Comprobando tu ubicación…" });
      try {
        const coords = await getCurrentCoords();
        const check = checkWithinLocations(coords, business.locations);
        if (!check.inside) {
          const dist = check.distance !== undefined ? ` Estás a ${fmtDistance(check.distance)} de «${check.nearest?.name}».` : "";
          setGeoMsg({ tone: "error", text: `Estás fuera de la zona de trabajo, no puedes fichar desde aquí.${dist}` });
          setBusy(false);
          return;
        }
        method = "geo";
        lat = coords.lat;
        lng = coords.lng;
      } catch (err) {
        setGeoMsg({ tone: "error", text: err instanceof Error ? err.message : "No se pudo obtener tu ubicación." });
        setBusy(false);
        return;
      }
    }

    try {
      await pb.collection("time_entries").create({
        business: business.id,
        user: user.id,
        type,
        method,
        at: new Date().toISOString(),
        ...(lat !== undefined ? { lat, lng } : {}),
        ...(projectsActive && selectedProject ? { project: selectedProject } : {}),
      });
      if (geoActive) setGeoMsg({ tone: "info", text: "✅ Ubicación verificada. Fichaje registrado." });
      await load();
    } catch {
      setGeoMsg({ tone: "error", text: "No se pudo registrar el fichaje. Inténtalo de nuevo." });
    } finally {
      setBusy(false);
    }
  }

  const stateMeta: Record<WorkState, { label: string; color: string }> = {
    out: { label: "Fuera de turno", color: "var(--text-muted)" },
    in: { label: "Trabajando", color: "var(--success)" },
    break: { label: "En pausa", color: "var(--warning)" },
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Hola, {user?.name?.split(" ")[0]} 👋</h1>
        <p className="text-muted">
          {new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>

      {/* Tarjeta principal de fichaje */}
      <div className="rounded-[calc(var(--radius)+6px)] border border-border bg-surface p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: stateMeta[state].color }} />
            <span className="font-medium text-ink">{stateMeta[state].label}</span>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-muted">Trabajado hoy</p>
            <p
              className="font-display text-2xl font-bold tabular-nums text-ink"
              style={state === "in" ? { color: "var(--success)" } : undefined}
            >
              {state === "out" ? fmtDuration(workedMs) : fmtStopwatch(workedMs)}
            </p>
          </div>
        </div>

        {geoActive && (
          <div className="mt-4 flex items-center gap-2 rounded-[var(--radius)] bg-surface2 px-3 py-2 text-sm text-muted">
            <span>📍</span>
            <span>Fichaje por ubicación activo: solo puedes fichar dentro de tu zona de trabajo.</span>
          </div>
        )}

        {geoMsg && (
          <p
            className="mt-3 rounded-[var(--radius)] px-3 py-2 text-sm"
            style={{
              color: geoMsg.tone === "error" ? "var(--danger)" : "var(--text)",
              backgroundColor:
                geoMsg.tone === "error"
                  ? "color-mix(in srgb, var(--danger) 12%, transparent)"
                  : "var(--surface-2)",
            }}
          >
            {geoMsg.text}
          </p>
        )}

        {projectsActive && projects.length > 0 && (
          <label className="mt-4 flex flex-col gap-1 text-sm">
            <span className="font-medium text-ink">Proyecto (opcional)</span>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="max-w-sm rounded-[var(--radius)] border border-border bg-canvas px-3 py-2 text-ink outline-none focus:border-primary"
            >
              <option value="">Sin proyecto</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.icon ? `${p.icon} ` : ""}
                  {p.name}
                  {p.client ? ` · ${p.client}` : ""}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          {state === "out" && (
            <button
              disabled={busy}
              onClick={() => ficha("in")}
              className="flex-1 rounded-[var(--radius)] bg-primary px-5 py-4 text-lg font-semibold text-on-primary transition hover:bg-primary-strong disabled:opacity-60"
            >
              ⏱️ Fichar entrada
            </button>
          )}
          {state === "in" && (
            <>
              <button
                disabled={busy}
                onClick={() => ficha("out")}
                className="flex-1 rounded-[var(--radius)] bg-danger px-5 py-4 text-lg font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
              >
                🏁 Fichar salida
              </button>
              <button
                disabled={busy}
                onClick={() => ficha("break_start")}
                className="rounded-[var(--radius)] border border-border bg-surface2 px-5 py-4 text-lg font-semibold text-ink transition hover:border-warning disabled:opacity-60"
              >
                ☕ Pausa
              </button>
            </>
          )}
          {state === "break" && (
            <button
              disabled={busy}
              onClick={() => ficha("break_end")}
              className="flex-1 rounded-[var(--radius)] bg-success px-5 py-4 text-lg font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
            >
              ▶️ Reanudar turno
            </button>
          )}
        </div>
      </div>

      {/* Línea temporal de hoy */}
      <div className="rounded-[calc(var(--radius)+6px)] border border-border bg-surface p-6">
        <h2 className="font-display text-lg font-bold text-ink">Fichajes de hoy</h2>
        {loading ? (
          <p className="mt-3 text-muted">Cargando…</p>
        ) : entries.length === 0 ? (
          <p className="mt-3 text-muted">Aún no has fichado hoy. Pulsa «Fichar entrada» para empezar.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {entries
              .slice()
              .reverse()
              .map((e) => (
                <li key={e.id} className="flex items-center gap-3">
                  <span className="font-display text-sm font-semibold tabular-nums text-ink">{fmtTime(e.at)}</span>
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  <span className="text-ink">{TYPE_LABEL[e.type]}</span>
                  <span className="ml-auto rounded-full bg-surface2 px-2 py-0.5 text-xs text-muted">
                    {METHOD_LABEL[e.method] ?? e.method}
                  </span>
                </li>
              ))}
          </ul>
        )}
      </div>
    </div>
  );
}
