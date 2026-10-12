import { NextResponse } from "next/server";
import { getAdminPB, getRequester } from "@/lib/pb-server";

/**
 * Lista todos los negocios de la plataforma con su nº de empleados.
 * SOLO para SuperAdmin (gestión multi-negocio).
 */
export async function GET(req: Request) {
  const requester = await getRequester(req);
  if (!requester) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (requester.role !== "superadmin") return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const admin = await getAdminPB();
  const [businesses, users] = await Promise.all([
    admin.collection("businesses").getFullList({ sort: "-created" }),
    admin.collection("users").getFullList({ fields: "id,business,active,role" }),
  ]);

  const counts = new Map<string, { total: number; active: number }>();
  for (const u of users) {
    const b = (u as { business?: string }).business;
    if (!b) continue;
    const c = counts.get(b) ?? { total: 0, active: 0 };
    c.total++;
    if ((u as { active?: boolean }).active) c.active++;
    counts.set(b, c);
  }

  const result = businesses.map((b) => {
    const modules = (b.modules ?? {}) as Record<string, boolean>;
    return {
      id: b.id,
      name: b.name,
      slug: b.slug,
      active: b.active,
      created: b.created,
      employees: counts.get(b.id)?.total ?? 0,
      activeEmployees: counts.get(b.id)?.active ?? 0,
      modulesOn: Object.values(modules).filter(Boolean).length,
    };
  });

  return NextResponse.json({ businesses: result });
}
