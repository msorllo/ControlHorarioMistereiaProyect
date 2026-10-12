import { col } from "./store";
import { LocalPB } from "./client";
import { hashPassword, newId } from "./util";
import { initStore } from "./store";
import { seedDemo } from "./seed";
import { DEFAULT_MODULES } from "@/config/modules";
import { computeWorkedMs, fmtDuration, heuristicIntent, startOfWeekISO } from "@/lib/assistant-core";
import type { Role } from "@/config/roles";

/**
 * Equivalente en el navegador de las rutas `/api/*` del servidor. En la demo no
 * hay servidor, así que la misma lógica (con las mismas comprobaciones de rol)
 * se ejecuta aquí sobre los datos locales del visitante.
 */

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export async function localApi(pb: LocalPB, path: string, init: RequestInit = {}): Promise<Response> {
  await initStore(seedDemo);
  const method = (init.method ?? "GET").toUpperCase();
  const body = init.body ? JSON.parse(String(init.body)) : {};
  const me = pb.authStore.record as (Record<string, unknown> & { id: string; role: Role; business: string }) | null;
  const users = col("users");

  // -- Alta pública de un negocio nuevo (sin sesión)
  if (path === "/api/signup" && method === "POST") {
    const businessName = String(body.businessName ?? "").trim();
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim();
    const password = String(body.password ?? "");
    if (!businessName || !name || !email) return json({ error: "Faltan datos obligatorios" }, 400);
    if (password.length < 8) return json({ error: "La contraseña debe tener al menos 8 caracteres" }, 400);
    if ([...users.values()].some((u) => String(u.email).toLowerCase() === email.toLowerCase())) {
      return json({ error: "Ese correo ya está registrado en esta demo" }, 400);
    }
    const base = slugify(businessName) || "negocio";
    const slugs = new Set([...col("businesses").values()].map((b) => b.slug));
    let slug = base;
    for (let i = 1; slugs.has(slug) && i <= 50; i++) slug = `${base}-${i}`;
    const biz = await pb.collection("businesses").create({
      name: businessName, slug, theme: { primary: "#7c5cff", accent: "#22d3ee" },
      modules: DEFAULT_MODULES, timezone: "Europe/Madrid", active: true,
    });
    const salt = newId();
    await pb.collection("users").create({
      name, email, role: "owner", job_title: "Dueño/a", business: biz.id, active: true,
      emailVisibility: true, verified: true, salt, password_hash: await hashPassword(password, salt),
    });
    return json({ ok: true, slug });
  }

  if (!me) return json({ error: "No autorizado" }, 401);

  // -- Guía del equipo (solo datos no sensibles)
  if (path === "/api/roster" && method === "GET") {
    const members = [...users.values()]
      .filter((u) => u.business === me.business)
      .sort((a, b) => String(a.name).localeCompare(String(b.name)))
      .map((u) => ({ id: u.id, name: u.name, role: u.role, active: u.active, avatar: u.avatar, job_title: u.job_title }));
    return json({ members });
  }

  // -- Empleados
  const canManage = me.role === "owner" || me.role === "manager";
  if (path === "/api/employees" && method === "POST") {
    if (!canManage) return json({ error: "No tienes permisos para dar de alta empleados" }, 403);
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim();
    const password = String(body.password ?? "");
    const role = String(body.role ?? "") as Role;
    if (!name || !email || !password || !role) return json({ error: "Faltan datos obligatorios" }, 400);
    if (password.length < 8) return json({ error: "La contraseña debe tener al menos 8 caracteres" }, 400);
    const allowed: Role[] = me.role === "owner" ? ["manager", "employee"] : ["employee"];
    if (!allowed.includes(role)) return json({ error: "No puedes asignar ese rol" }, 403);
    if ([...users.values()].some((u) => String(u.email).toLowerCase() === email.toLowerCase())) {
      return json({ error: "Ese correo ya está en uso" }, 400);
    }
    const salt = newId();
    const created = await pb.collection("users").create({
      name, email, role, job_title: String(body.job_title ?? "").trim(),
      hourly_rate: Math.max(0, Number(body.hourly_rate) || 0), business: me.business, active: true,
      emailVisibility: true, verified: true, salt, password_hash: await hashPassword(password, salt),
    });
    return json({ id: (created as { id: string }).id, ok: true });
  }

  const m = path.match(/^\/api\/employees\/([^/]+)$/);
  if (m && method === "PATCH") {
    if (!canManage) return json({ error: "Sin permisos" }, 403);
    const target = users.get(m[1]);
    if (!target) return json({ error: "Empleado no encontrado" }, 404);
    if (target.business !== me.business) return json({ error: "Ese empleado no es de tu negocio" }, 403);
    const patch: Record<string, unknown> = {};
    if (typeof body.name === "string") patch.name = body.name.trim();
    if (typeof body.job_title === "string") patch.job_title = body.job_title.trim();
    if (typeof body.active === "boolean") patch.active = body.active;
    if (body.hourly_rate !== undefined) patch.hourly_rate = Math.max(0, Number(body.hourly_rate) || 0);
    if (body.role && me.role === "owner" && ["manager", "employee"].includes(body.role)) patch.role = body.role;
    await pb.collection("users").update(m[1], patch);
    return json({ id: m[1], ok: true });
  }

  // -- Asistente: en la demo solo reglas (sin IA de pago ni servidores)
  if (path === "/api/assistant" && method === "POST") {
    const message = String(body.message ?? "").trim();
    if (!message) return json({ error: "Mensaje vacío" }, 400);
    const intent = heuristicIntent(message);
    const source = "reglas";

    if (intent.intent === "horas") {
      const since = startOfWeekISO();
      const entries = [...col("time_entries").values()]
        .filter((e) => e.user === me.id && String(e.at) >= since)
        .sort((a, b) => String(a.at).localeCompare(String(b.at))) as unknown as { type: string; at: string }[];
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const today = entries.filter((e) => new Date(e.at) >= todayStart);
      return json({
        reply: `Esta semana llevas ${fmtDuration(computeWorkedMs(entries))} trabajadas (hoy: ${fmtDuration(
          computeWorkedMs(today),
        )}, con ${today.length} fichajes). ¿Necesitas algo más?`,
        source,
      });
    }

    if (intent.intent === "ausencia") {
      const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
      const type = intent.absence?.type ?? "sick";
      const typeLabel: Record<string, string> = { sick: "baja por enfermedad", vacation: "vacaciones", personal: "asunto personal", other: "ausencia" };
      return json({
        reply: `Puedo registrar una ${typeLabel[type]} del ${tomorrow} al ${tomorrow} y avisar a tu responsable para que la apruebe. ¿Lo confirmo?`,
        source,
        proposal: { kind: "absence", type, start_date: tomorrow, end_date: tomorrow, note: message.slice(0, 200) },
      });
    }

    return json({
      reply: "Puedo ayudarte con tus horas trabajadas («¿cuántas horas llevo esta semana?») o registrar una ausencia («mañana estoy malo»). ¿Qué necesitas?",
      source,
    });
  }

  // -- Panel de superadmin: no existe en la demo
  if (path === "/api/businesses") return json({ error: "Sin permisos" }, 403);

  return json({ error: "No encontrado" }, 404);
}
