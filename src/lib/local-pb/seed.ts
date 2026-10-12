import { col, persist, type Rec } from "./store";
import { hashPassword, newId } from "./util";
import { DEFAULT_MODULES } from "@/config/modules";

/**
 * Datos de ejemplo 100 % FICTICIOS para la demo pública. Se generan en el
 * navegador de cada visitante la primera vez que entra (fechas relativas a hoy).
 */

export const DEMO_PASSWORD = "mistereia123";
export const DEMO_EMAILS = {
  owner: "dueno@demo.mistereia",
  manager: "responsable@demo.mistereia",
  employee: "empleado@demo.mistereia",
};

// PDF mínimo válido (una página en blanco) para los documentos de ejemplo.
const MINI_PDF =
  "%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 150]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF";

function put(c: string, fields: Record<string, unknown>, id = newId(), at = new Date()): Rec {
  const iso = at.toISOString();
  const rec = { ...fields, id, created: iso, updated: iso } as Rec;
  col(c).set(id, rec);
  persist(c, rec);
  return rec;
}

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function at(day: Date, h: number, m = 0): Date {
  const d = new Date(day);
  d.setHours(h, m, 0, 0);
  return d;
}

export async function seedDemo(): Promise<void> {
  const now = new Date();

  const biz = put("businesses", {
    name: "Panadería Demo",
    slug: "demo",
    theme: { primary: "#7c5cff", accent: "#22d3ee" },
    modules: Object.fromEntries(Object.keys(DEFAULT_MODULES).map((k) => [k, true])),
    timezone: "Europe/Madrid",
    active: true,
    locations: [],
  });
  // La ubicación (geofencing) se deja sin zonas: pide permisos de GPS solo si el visitante la configura.
  (biz.modules as Record<string, boolean>).geofencing = false;
  persist("businesses", biz);

  const people = [
    { key: "owner", email: DEMO_EMAILS.owner, name: "Ana (Dueña)", role: "owner", job_title: "Propietaria", hourly_rate: 0 },
    { key: "manager", email: DEMO_EMAILS.manager, name: "Luis (Responsable)", role: "manager", job_title: "Encargado de turno", hourly_rate: 15 },
    { key: "employee", email: DEMO_EMAILS.employee, name: "María (Empleada)", role: "employee", job_title: "Dependienta", hourly_rate: 12 },
    { key: "carlos", email: "carlos@demo.mistereia", name: "Carlos (Empleado)", role: "employee", job_title: "Obrador", hourly_rate: 11 },
  ];
  const u: Record<string, Rec> = {};
  for (const p of people) {
    const salt = newId();
    u[p.key] = put("users", {
      email: p.email,
      name: p.name,
      role: p.role,
      job_title: p.job_title,
      hourly_rate: p.hourly_rate,
      business: biz.id,
      active: true,
      emailVisibility: true,
      verified: true,
      salt,
      password_hash: await hashPassword(DEMO_PASSWORD, salt),
    });
  }

  // Proyectos
  const pReforma = put("projects", {
    business: biz.id, name: "Reforma cocina", client: "Familia García", color: "#7c5cff", icon: "🔨",
    status: "en_curso", active: true, budget_hours: 40, billing_rate: 35,
    deadline: ymd(new Date(now.getTime() + 20 * 86400000)), description: "Reforma integral de cocina.", created_by: u.owner.id,
  });
  const pTienda = put("projects", {
    business: biz.id, name: "Montaje tienda", client: "Bar Pepe", color: "#22d3ee", icon: "📦",
    status: "en_curso", active: true, budget_hours: 20, billing_rate: 40,
    deadline: ymd(new Date(now.getTime() - 5 * 86400000)), description: "Montaje de mobiliario.", created_by: u.owner.id,
  });

  // Fichajes de los últimos 14 días laborables
  const staff = [u.manager, u.employee, u.carlos];
  for (let back = 1; back <= 14; back++) {
    const day = new Date(now);
    day.setDate(day.getDate() - back);
    if (day.getDay() === 0 || day.getDay() === 6) continue;
    for (const [i, person] of staff.entries()) {
      const start = 8 + (i === 2 ? 1 : 0);
      const long = person === u.employee && back % 4 === 0; // alguna jornada larga (para anti-burnout)
      const proj = i === 1 ? (back % 2 ? pReforma : pTienda) : null;
      const entries: [string, Date][] = [
        ["in", at(day, start, i * 5)],
        ["break_start", at(day, 12, 30)],
        ["break_end", at(day, 13, 0)],
        ["out", at(day, start + (long ? 10 : 8), 0)],
      ];
      for (const [type, when] of entries) {
        put(
          "time_entries",
          {
            business: biz.id, user: person.id, type, method: "manual", at: when.toISOString(),
            ...(type === "in" && proj ? { project: proj.id } : {}),
          },
          newId(),
          when,
        );
      }
    }
  }
  // Hoy: Luis ya está trabajando (si la hora lo permite)
  const entry = new Date(Math.min(at(now, 8, 0).getTime(), now.getTime() - 30 * 60000));
  if (entry.getDate() === now.getDate()) {
    put("time_entries", { business: biz.id, user: u.manager.id, type: "in", method: "manual", at: entry.toISOString() }, newId(), entry);
  }

  // Turnos de esta semana
  const monday = new Date(now);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  for (let d = 0; d < 5; d++) {
    const day = new Date(monday);
    day.setDate(day.getDate() + d);
    for (const [i, person] of staff.entries()) {
      put("shifts", {
        business: biz.id, user: person.id, date: ymd(day),
        start_time: i === 2 ? "09:00" : "08:00", end_time: i === 2 ? "17:00" : "16:00",
        note: "", created_by: u.owner.id,
      });
    }
  }

  // Anuncios
  put("announcements", {
    business: biz.id, author: u.owner.id, pinned: true,
    title: "Bienvenido a la demo de Control Horario",
    body: "Estás en una demo: tus datos se guardan solo en tu navegador y nadie más los ve. Prueba a fichar, crear un proyecto o chatear.",
  });
  put("announcements", {
    business: biz.id, author: u.owner.id, pinned: false,
    title: "Cambio de horario el viernes", body: "El viernes cerramos a las 15:00 por inventario.",
  });

  // Reconocimientos
  put("kudos", { business: biz.id, from_user: u.manager.id, to_user: u.employee.id, emoji: "🌟", message: "¡Gran trabajo con el pedido grande!" });
  put("kudos", { business: biz.id, from_user: u.owner.id, to_user: u.carlos.id, emoji: "🥖", message: "El mejor pan de la zona." });

  // Ausencia pendiente (propuesta por el asistente)
  const t = new Date(now.getTime() + 86400000);
  put("absences", {
    business: biz.id, user: u.employee.id, type: "personal", status: "pending",
    start_date: ymd(t), end_date: ymd(t), note: "Gestión personal", suggested_by_ai: true,
  });

  // Documentos de ejemplo
  const doc = (title: string, type: string, user: Rec | null, expires: string) => {
    put("documents", {
      business: biz.id, title, doc_type: type, user: user?.id ?? "", expires, uploaded_by: u.owner.id,
      file: `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`,
      __blob_file: new Blob([MINI_PDF], { type: "application/pdf" }),
    });
  };
  doc("Nómina del mes pasado", "nomina", u.employee, "");
  doc("Contrato indefinido", "contrato", u.employee, "");
  doc("Certificado de manipulador de alimentos", "certificado", u.employee, ymd(new Date(now.getTime() + 15 * 86400000)));
  doc("Calendario laboral", "otro", null, "");

  // Chat: canal General con unos mensajes
  const general = put("conversations", {
    business: biz.id, type: "channel", name: "General", members: Object.values(u).map((x) => x.id),
  });
  const msg = (from: Rec, text: string, minsAgo: number) =>
    put(
      "messages",
      { business: biz.id, conversation: general.id, sender: from.id, text },
      newId(),
      new Date(now.getTime() - minsAgo * 60000),
    );
  msg(u.owner, "¡Buenos días equipo! 👋", 180);
  msg(u.manager, "Buenos días. Ya está el obrador listo.", 170);
  msg(u.employee, "Voy de camino, llego en 10 minutos.", 150);
}
