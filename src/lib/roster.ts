import { apiFetch } from "@/lib/api";
import type { Role } from "@/config/roles";

/** Miembro del equipo con datos NO sensibles (para chat, logros, menciones…). */
export interface RosterMember {
  id: string;
  name: string;
  role: Role;
  active: boolean;
  avatar?: string;
  job_title?: string;
}

/**
 * Obtiene la guía del equipo a través de la ruta segura `/api/roster`.
 * A diferencia de listar `users` directamente, esto funciona también para
 * empleados (que por RLS solo pueden verse a sí mismos en la colección users).
 */
export async function fetchRoster(): Promise<RosterMember[]> {
  try {
    const res = await apiFetch("/api/roster");
    if (!res.ok) return [];
    const data = await res.json();
    return (data.members ?? []) as RosterMember[];
  } catch {
    return [];
  }
}
