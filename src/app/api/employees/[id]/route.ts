import { NextResponse } from "next/server";
import { getAdminPB, getRequester } from "@/lib/pb-server";
import type { Role } from "@/config/roles";

/** Edita un empleado del mismo negocio (nombre, puesto, rol, activo/inactivo). */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const requester = await getRequester(req);
  if (!requester) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (requester.role !== "owner" && requester.role !== "manager") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const admin = await getAdminPB();
  let target;
  try {
    target = await admin.collection("users").getOne(id);
  } catch {
    return NextResponse.json({ error: "Empleado no encontrado" }, { status: 404 });
  }
  if (target.business !== requester.business) {
    return NextResponse.json({ error: "Ese empleado no es de tu negocio" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string") patch.name = body.name.trim();
  if (typeof body.job_title === "string") patch.job_title = body.job_title.trim();
  if (typeof body.active === "boolean") patch.active = body.active;
  if (body.hourly_rate !== undefined) patch.hourly_rate = Math.max(0, Number(body.hourly_rate) || 0);
  // Solo el dueño puede cambiar el rol, y nunca a superadmin.
  if (body.role && requester.role === "owner") {
    const role = body.role as Role;
    if (["manager", "employee"].includes(role)) patch.role = role;
  }

  try {
    const updated = await admin.collection("users").update(id, patch);
    return NextResponse.json({ id: updated.id, ok: true });
  } catch {
    return NextResponse.json({ error: "No se pudo actualizar" }, { status: 400 });
  }
}
