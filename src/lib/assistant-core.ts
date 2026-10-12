/** Lógica pura del asistente (sin IA ni servidor): compartida por la API y la demo local. */
export interface Intent {
  intent: "ausencia" | "horas" | "charla";
  reply?: string;
  absence?: { type?: string; start_date?: string; end_date?: string; note?: string };
}

export function startOfWeekISO() {
  const d = new Date();
  const day = (d.getDay() + 6) % 7; // lunes = 0
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function fmtDuration(ms: number) {
  const min = Math.max(0, Math.floor(ms / 60000));
  return `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, "0")}m`;
}

/** Suma el tiempo trabajado a partir de los fichajes (pares entrada/salida y pausas). */
export function computeWorkedMs(entries: { type: string; at: string }[]) {
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

/** Red de seguridad: clasificación por reglas cuando no hay IA disponible. */
export function heuristicIntent(message: string): Intent {
  const m = message.toLowerCase();
  if (/(estoy|estare|estaré|me encuentro)?\s*(malo|mala|enfermo|enferma|fatal)|no (puedo|podre|podré) (ir|venir)|me duele|tengo (fiebre|gripe|covid)|baja m[eé]dica/.test(m)) {
    return { intent: "ausencia", absence: { type: "sick" } };
  }
  if (/vacaciones|d[ií]as? libres?|asunto propio|permiso/.test(m)) {
    return { intent: "ausencia", absence: { type: "vacation" } };
  }
  if (/horas|cu[aá]nto (llevo|he trabajado)|trabajado (hoy|esta semana)|jornada/.test(m)) {
    return { intent: "horas" };
  }
  return { intent: "charla" };
}
