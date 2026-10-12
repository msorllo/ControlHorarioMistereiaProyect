import type { Role } from "@/config/roles";
import type { ModuleId } from "@/config/modules";
import type { WorkLocation } from "@/lib/geo";

/** Personalización visual de cada negocio (marca blanca). */
export interface BusinessTheme {
  primary?: string;
  accent?: string;
  logo?: string;
}

/** Configuración del asistente IA por negocio. */
export interface BusinessAI {
  provider?: "auto" | "ollama" | "anthropic" | "none";
  model?: string;
}

/** Un negocio (tenant). Cada uno tiene su propio espacio y configuración. */
export interface Business {
  id: string;
  name: string;
  slug: string;
  theme: BusinessTheme;
  modules: Record<ModuleId, boolean>;
  timezone: string;
  ai?: BusinessAI;
  locations?: WorkLocation[];
  created: string;
  updated: string;
}

/** Usuario de la plataforma (extiende la colección de auth de PocketBase). */
export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  business: string; // id del negocio al que pertenece
  avatar?: string;
  active: boolean;
}

export type TimeEntryType = "in" | "out" | "break_start" | "break_end";
export type CheckinMethod = "manual" | "geo" | "qr" | "nfc" | "voice";

/** Un evento de fichaje (registro legal e inmutable). */
export interface TimeEntry {
  id: string;
  business: string;
  user: string;
  type: TimeEntryType;
  method: CheckinMethod;
  at: string;
  lat?: number;
  lng?: number;
  note?: string;
  created: string;
}
