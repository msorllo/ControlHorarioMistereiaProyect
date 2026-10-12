/** Un fichaje mínimo para calcular sesiones trabajadas. */
export interface SessionEntry {
  user?: string;
  type: string;
  at: string;
  project?: string;
}

/**
 * Reconstruye las sesiones de trabajo (intervalos) con el proyecto imputado,
 * para un conjunto de fichajes de UN empleado. Empareja in/break_end con
 * out/break_start, atribuyendo el proyecto del "in" que abrió la sesión.
 */
export function sessionsWithProject(entries: SessionEntry[]): { project: string; minutes: number }[] {
  const sorted = [...entries].sort((a, b) => a.at.localeCompare(b.at));
  const out: { project: string; minutes: number }[] = [];
  let open: { start: number; project: string } | null = null;
  let current = "";
  for (const e of sorted) {
    const t = new Date(e.at).getTime();
    if (e.type === "in") {
      current = e.project ?? "";
      open = { start: t, project: current };
    } else if (e.type === "break_end") {
      open = { start: t, project: current };
    } else if (e.type === "out" || e.type === "break_start") {
      if (open) {
        out.push({ project: open.project, minutes: (t - open.start) / 60000 });
        open = null;
      }
    }
  }
  if (open) out.push({ project: open.project, minutes: (Date.now() - open.start) / 60000 });
  return out;
}

/**
 * Horas trabajadas por proyecto a partir de fichajes de VARIOS empleados.
 * Agrupa por usuario para reconstruir sesiones correctamente.
 * Devuelve un Map projectId (o "" para "sin proyecto") → horas.
 */
export function hoursByProject(entries: SessionEntry[]): Map<string, number> {
  const byUser = new Map<string, SessionEntry[]>();
  for (const e of entries) {
    const u = e.user ?? "_";
    const arr = byUser.get(u) ?? [];
    arr.push(e);
    byUser.set(u, arr);
  }
  const hours = new Map<string, number>();
  for (const list of byUser.values()) {
    for (const s of sessionsWithProject(list)) {
      hours.set(s.project, (hours.get(s.project) ?? 0) + s.minutes / 60);
    }
  }
  return hours;
}
