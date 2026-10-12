/**
 * Roles del sistema. La interfaz se adapta POR COMPLETO según el rol activo:
 * un empleado no ve lo mismo que un dueño de negocio.
 */
export type Role = "superadmin" | "owner" | "manager" | "employee";

export interface RoleDef {
  name: string;
  description: string;
  /** Nivel de poder (mayor = más permisos). Útil para comparaciones rápidas. */
  level: number;
}

export const ROLES: Record<Role, RoleDef> = {
  superadmin: {
    name: "Super Administrador",
    description: "Gestiona todos los negocios de la plataforma.",
    level: 100,
  },
  owner: {
    name: "Dueño del negocio",
    description: "Control total de su negocio y de su configuración.",
    level: 80,
  },
  manager: {
    name: "Responsable / Manager",
    description: "Gestiona equipo, turnos y fichajes de su departamento.",
    level: 50,
  },
  employee: {
    name: "Empleado",
    description: "Ficha, chatea y consulta su propia información.",
    level: 10,
  },
};

/** Comprueba si un rol tiene al menos el nivel de otro. */
export function roleAtLeast(role: Role, min: Role): boolean {
  return ROLES[role].level >= ROLES[min].level;
}
