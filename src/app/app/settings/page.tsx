"use client";

import { useEffect, useRef, useState } from "react";
import { getPB } from "@/lib/pb";
import { useAuth } from "@/providers/AuthProvider";
import { MODULES, type ModuleId } from "@/config/modules";
import { getCurrentCoords, type WorkLocation } from "@/lib/geo";
import { applyBrand } from "@/lib/theme";
import type { Business } from "@/lib/types";

export default function SettingsPage() {
  const { user, business, updateBusiness } = useAuth();
  const pb = getPB();

  const [name, setName] = useState("");
  const [primary, setPrimary] = useState("#7c5cff");
  const [accent, setAccent] = useState("#22d3ee");
  const [modules, setModules] = useState<Record<string, boolean>>({});
  const [savingInfo, setSavingInfo] = useState(false);
  const [savedInfo, setSavedInfo] = useState(false);

  // Zonas de trabajo (geofencing)
  const [locations, setLocations] = useState<WorkLocation[]>([]);
  const [zoneName, setZoneName] = useState("");
  const [zoneLat, setZoneLat] = useState("");
  const [zoneLng, setZoneLng] = useState("");
  const [zoneRadius, setZoneRadius] = useState("100");
  const [zoneMsg, setZoneMsg] = useState<string | null>(null);

  // Último valor deseado de módulos/zonas y cola de guardado: los cambios rápidos se guardan EN ORDEN
  // y siempre gana el último, sin pisarse entre sí ni quedarse con datos antiguos.
  const modulesRef = useRef<Record<string, boolean>>({});
  const locationsRef = useRef<WorkLocation[]>([]);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const [saveError, setSaveError] = useState<string | null>(null);

  // Rellena el formulario solo al cargar el negocio (no cada vez que se guarda, para no pisar lo que escribes).
  const businessId = business?.id;
  useEffect(() => {
    if (!business) return;
    setName(business.name);
    setPrimary(business.theme?.primary ?? "#7c5cff");
    setAccent(business.theme?.accent ?? "#22d3ee");
    setModules(business.modules ?? {});
    modulesRef.current = business.modules ?? {};
    setLocations(business.locations ?? []);
    locationsRef.current = business.locations ?? [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  if (user?.role !== "owner") {
    return <p className="text-muted">Solo el dueño del negocio puede acceder a la configuración.</p>;
  }
  if (!business) return <p className="text-muted">Cargando…</p>;

  /** Encola un guardado en la base de datos y, al terminar, actualiza el negocio global (menú, tema…). */
  function save(patch: Record<string, unknown>) {
    const run = async () => {
      try {
        const rec = await pb.collection("businesses").update(business!.id, patch);
        updateBusiness(rec as unknown as Business);
        setSaveError(null);
      } catch {
        setSaveError("No se pudo guardar. Se ha restaurado lo último guardado; inténtalo de nuevo.");
        try {
          const fresh = (await pb.collection("businesses").getOne(business!.id)) as unknown as Business;
          updateBusiness(fresh);
          setModules(fresh.modules ?? {});
          modulesRef.current = fresh.modules ?? {};
          setLocations(fresh.locations ?? []);
          locationsRef.current = fresh.locations ?? [];
        } catch {
          /* sin conexión */
        }
      }
    };
    queue.current = queue.current.then(run, run);
    return queue.current;
  }

  async function saveInfo(e: React.FormEvent) {
    e.preventDefault();
    setSavingInfo(true);
    setSavedInfo(false);
    await save({ name, theme: { ...business!.theme, primary, accent } });
    applyBrand(primary, accent);
    setSavingInfo(false);
    setSavedInfo(true);
    setTimeout(() => setSavedInfo(false), 2500);
  }

  function toggleModule(id: ModuleId) {
    const next = { ...modulesRef.current, [id]: !modulesRef.current[id] };
    modulesRef.current = next;
    setModules(next); // optimista e inmediato
    save({ modules: next });
  }

  function persistLocations(next: WorkLocation[]) {
    locationsRef.current = next;
    setLocations(next);
    return save({ locations: next });
  }

  async function useMyLocation() {
    setZoneMsg("Obteniendo tu ubicación…");
    try {
      const c = await getCurrentCoords();
      setZoneLat(c.lat.toFixed(6));
      setZoneLng(c.lng.toFixed(6));
      setZoneMsg(`Ubicación capturada (precisión ~${Math.round(c.accuracy ?? 0)} m).`);
    } catch (err) {
      setZoneMsg(err instanceof Error ? err.message : "No se pudo obtener la ubicación.");
    }
  }

  async function addZone(e: React.FormEvent) {
    e.preventDefault();
    const lat = parseFloat(zoneLat);
    const lng = parseFloat(zoneLng);
    const radius = Math.max(20, parseInt(zoneRadius, 10) || 100);
    if (!zoneName.trim() || Number.isNaN(lat) || Number.isNaN(lng)) {
      setZoneMsg("Pon un nombre y unas coordenadas válidas (usa «Mi ubicación actual»).");
      return;
    }
    await persistLocations([...locationsRef.current, { name: zoneName.trim(), lat, lng, radius_m: radius }]);
    setZoneName("");
    setZoneLat("");
    setZoneLng("");
    setZoneRadius("100");
    setZoneMsg(null);
  }

  const geofencingOn = !!modules.geofencing;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Configuración del negocio</h1>
        <p className="text-muted">Personaliza tu espacio. Los cambios se guardan en tu base de datos.</p>
      </div>

      {/* Datos y marca */}
      <form onSubmit={saveInfo} className="flex flex-col gap-4 rounded-[var(--radius)] border border-border bg-surface p-5">
        <h2 className="font-display text-lg font-bold text-ink">Datos y marca</h2>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink">Nombre del negocio</span>
          <input value={name} onChange={(e) => setName(e.target.value)}
            className="max-w-sm rounded-[var(--radius)] border border-border bg-canvas px-3 py-2 text-ink outline-none focus:border-primary" />
        </label>
        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-3 text-sm">
            <span className="font-medium text-ink">Color principal</span>
            <input type="color" value={primary} onChange={(e) => { setPrimary(e.target.value); applyBrand(e.target.value, accent); }}
              className="h-9 w-14 cursor-pointer rounded border border-border bg-transparent" />
          </label>
          <label className="flex items-center gap-3 text-sm">
            <span className="font-medium text-ink">Color de acento</span>
            <input type="color" value={accent} onChange={(e) => { setAccent(e.target.value); applyBrand(primary, e.target.value); }}
              className="h-9 w-14 cursor-pointer rounded border border-border bg-transparent" />
          </label>
        </div>
        <div className="flex items-center gap-3">
          <button disabled={savingInfo} type="submit"
            className="rounded-[var(--radius)] bg-primary px-4 py-2 font-semibold text-on-primary transition hover:bg-primary-strong disabled:opacity-60">
            {savingInfo ? "Guardando…" : "Guardar"}
          </button>
          {savedInfo && !saveError && <span className="text-sm text-success">✔ Guardado</span>}
          {saveError && <span className="text-sm text-danger">{saveError}</span>}
        </div>
      </form>

      {/* Módulos */}
      <div className="flex flex-col gap-4 rounded-[var(--radius)] border border-border bg-surface p-5">
        <div>
          <h2 className="font-display text-lg font-bold text-ink">Módulos</h2>
          <p className="text-sm text-muted">Enciende solo lo que tu negocio necesita.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {MODULES.map((m) => {
            const on = !!modules[m.id];
            return (
              <button
                key={m.id}
                onClick={() => toggleModule(m.id)}
                className={`flex items-start gap-3 rounded-[var(--radius)] border p-4 text-left transition ${
                  on ? "border-primary bg-primary/8" : "border-border bg-surface hover:border-border"
                }`}
              >
                <span className="text-2xl">{m.icon}</span>
                <span className="flex-1">
                  <span className="flex items-center gap-2">
                    <span className="font-semibold text-ink">{m.name}</span>
                    <span className="rounded-full bg-surface2 px-1.5 py-0.5 text-[10px] text-muted">Fase {m.phase}</span>
                  </span>
                  <span className="mt-0.5 block text-sm text-muted">{m.description}</span>
                </span>
                <span
                  className={`mt-1 flex h-6 w-10 items-center rounded-full border p-0.5 transition ${on ? "border-primary bg-primary" : "border-border bg-surface2"}`}
                  aria-hidden
                >
                  <span className={`h-5 w-5 rounded-full transition ${on ? "translate-x-4 bg-on-primary" : "bg-white shadow"}`} />
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Zonas de trabajo (geofencing) */}
      {geofencingOn && (
        <div className="flex flex-col gap-4 rounded-[var(--radius)] border border-border bg-surface p-5">
          <div>
            <h2 className="font-display text-lg font-bold text-ink">📍 Zonas de trabajo</h2>
            <p className="text-sm text-muted">
              Define dónde puede fichar tu equipo. Solo se permitirá fichar dentro del radio de una zona.
            </p>
          </div>

          {locations.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {locations.map((loc, i) => (
                <li key={i} className="flex items-center gap-3 rounded-[var(--radius)] bg-surface2 p-3">
                  <span className="text-xl">📌</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink">{loc.name}</p>
                    <p className="text-xs text-muted">
                      {loc.lat.toFixed(5)}, {loc.lng.toFixed(5)} · radio {loc.radius_m} m
                    </p>
                  </div>
                  <button
                    onClick={() => persistLocations(locationsRef.current.filter((_, j) => j !== i))}
                    className="rounded-full border border-border bg-surface px-3 py-1 text-sm text-ink transition hover:border-danger hover:text-danger"
                  >
                    Quitar
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Aún no has definido ninguna zona. Añade la primera abajo.</p>
          )}

          <form onSubmit={addZone} className="grid gap-3 rounded-[var(--radius)] border border-border p-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="font-medium text-ink">Nombre de la zona</span>
              <input
                value={zoneName}
                onChange={(e) => setZoneName(e.target.value)}
                placeholder="p. ej. Local principal"
                className="rounded-[var(--radius)] border border-border bg-canvas px-3 py-2 text-ink outline-none focus:border-primary"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-ink">Latitud</span>
              <input
                value={zoneLat}
                onChange={(e) => setZoneLat(e.target.value)}
                placeholder="41.38790"
                className="rounded-[var(--radius)] border border-border bg-canvas px-3 py-2 text-ink outline-none focus:border-primary"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-ink">Longitud</span>
              <input
                value={zoneLng}
                onChange={(e) => setZoneLng(e.target.value)}
                placeholder="2.16999"
                className="rounded-[var(--radius)] border border-border bg-canvas px-3 py-2 text-ink outline-none focus:border-primary"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-ink">Radio (metros)</span>
              <input
                type="number"
                min={20}
                value={zoneRadius}
                onChange={(e) => setZoneRadius(e.target.value)}
                className="rounded-[var(--radius)] border border-border bg-canvas px-3 py-2 text-ink outline-none focus:border-primary"
              />
            </label>
            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={useMyLocation}
                className="rounded-[var(--radius)] border border-border bg-surface2 px-4 py-2 text-sm font-medium text-ink transition hover:border-primary"
              >
                📍 Mi ubicación actual
              </button>
              <button
                type="submit"
                className="rounded-[var(--radius)] bg-primary px-4 py-2 font-semibold text-on-primary transition hover:bg-primary-strong"
              >
                Añadir zona
              </button>
            </div>
            {zoneMsg && <p className="text-sm text-muted sm:col-span-2">{zoneMsg}</p>}
          </form>
        </div>
      )}
    </div>
  );
}
