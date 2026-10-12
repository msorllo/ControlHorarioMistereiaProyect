/**
 * Registro central de módulos activables por negocio (hiper-configurabilidad).
 *
 * Cada negocio guarda en `businesses.modules` un objeto { [id]: boolean }.
 * Así una panadería y una agencia tecnológica usan LA MISMA app, pero con
 * piezas distintas encendidas. La UI muestra u oculta secciones según esto.
 */
export type ModuleId =
  | "time_tracking"
  | "chat"
  | "shifts"
  | "absences"
  | "geofencing"
  | "ai_assistant"
  | "burnout"
  | "payroll_export"
  | "projects"
  | "gamification"
  | "documents"
  | "announcements";

export interface ModuleDef {
  id: ModuleId;
  /** Nombre visible para el dueño del negocio (español). */
  name: string;
  /** Explicación breve, pensada para gente sin conocimientos técnicos. */
  description: string;
  /** Emoji identificativo (se sustituirá por iconos SVG más adelante). */
  icon: string;
  /** Fase del roadmap en la que se entrega. */
  phase: 1 | 2 | 3;
  /** Si viene activado por defecto al crear un negocio nuevo. */
  defaultOn: boolean;
}

export const MODULES: ModuleDef[] = [
  { id: "time_tracking", name: "Fichaje", description: "Entradas, salidas y pausas con historial legal.", icon: "⏱️", phase: 1, defaultOn: true },
  { id: "chat", name: "Chat de equipo", description: "Mensajería en tiempo real estilo WhatsApp.", icon: "💬", phase: 1, defaultOn: true },
  { id: "shifts", name: "Turnos y cuadrantes", description: "Planifica turnos y coberturas arrastrando y soltando.", icon: "📅", phase: 2, defaultOn: false },
  { id: "absences", name: "Ausencias y vacaciones", description: "Solicitudes, aprobaciones y saldo automático.", icon: "🌴", phase: 2, defaultOn: false },
  { id: "geofencing", name: "Fichaje por ubicación", description: "Ficha automáticamente al llegar al lugar de trabajo.", icon: "📍", phase: 2, defaultOn: false },
  { id: "ai_assistant", name: "Asistente IA", description: "Entiende intenciones del chat y sugiere acciones a RRHH.", icon: "🤖", phase: 2, defaultOn: false },
  { id: "burnout", name: "Anti-burnout", description: "Avisa cuando alguien acumula demasiados turnos duros.", icon: "😌", phase: 2, defaultOn: false },
  { id: "payroll_export", name: "Exportar a gestoría", description: "Informes de horas y costes en Excel/PDF.", icon: "📊", phase: 3, defaultOn: false },
  { id: "projects", name: "Horas por proyecto", description: "Imputa horas a clientes o proyectos concretos.", icon: "🗂️", phase: 3, defaultOn: false },
  { id: "gamification", name: "Gamificación", description: "Rachas de puntualidad y reconocimientos entre compañeros.", icon: "🏆", phase: 3, defaultOn: false },
  { id: "documents", name: "Documentos", description: "Nóminas y contratos con control de caducidad.", icon: "📁", phase: 3, defaultOn: false },
  { id: "announcements", name: "Tablón de anuncios", description: "Comunicados y encuestas para todo el equipo.", icon: "📣", phase: 3, defaultOn: false },
];

/** Módulos activados por defecto al dar de alta un negocio nuevo. */
export const DEFAULT_MODULES: Record<ModuleId, boolean> = Object.fromEntries(
  MODULES.map((m) => [m.id, m.defaultOn]),
) as Record<ModuleId, boolean>;
