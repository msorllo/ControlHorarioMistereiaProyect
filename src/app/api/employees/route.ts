import { NextResponse } from "next/server";
import { friendlyPbError } from "@/lib/pb-errors";
import { getAdminPB, getRequester } from "@/lib/pb-server";
import type { Role } from "@/config/roles";

/** Crea un empleado nuevo dentro del negocio del solicitante (owner/manager). */
export async function POST(req: Request) {
  const requester = await getRequester(req);
  if (!requester) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (requester.role !== "owner" && requester.role !== "manager") {
    return NextResponse.json({ error: "No tienes permisos para dar de alta empleados" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  const email = String(body?.email ?? "").trim();
  const password = String(body?.password ?? "");
  const role = String(body?.role ?? "") as Role;
  const jobTitle = String(body?.job_title ?? "").trim();
  const hourlyRate = Math.max(0, Number(body?.hourly_rate) || 0);

  if (!name || !email || !password || !role) {
    return NextResponse.json({ error: "Faltan datos obligatorios" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres" }, { status: 400 });
  }
  // Un dueño puede crear responsables o empleados; un responsable, solo empleados.
  const allowed: Role[] = requester.role === "owner" ? ["manager", "employee"] : ["employee"];
  if (!allowed.includes(role)) {
    return NextResponse.json({ error: "No puedes asignar ese rol" }, { status: 403 });
  }

  const admin = await getAdminPB();
  try {
    const created = await admin.collection("users").create({
      name,
      email,
      password,
      passwordConfirm: password,
      role,
      job_title: jobTitle,
      hourly_rate: hourlyRate,
      business: requester.business,
      active: true,
      emailVisibility: true,
      verified: true,
    });
    return NextResponse.json({ id: created.id, ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: friendlyPbError(e, "No se pudo crear el empleado") }, { status: 400 });
  }
}
