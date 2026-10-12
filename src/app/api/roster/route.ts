import { NextResponse } from "next/server";
import { getAdminPB, getRequester } from "@/lib/pb-server";

/**
 * Devuelve la "guía" del equipo (id, nombre, rol, avatar) para el negocio del
 * solicitante. Cualquier miembro autenticado puede verla — es lo que permite
 * que empleados vean los nombres de sus compañeros en el chat y los logros,
 * SIN exponer datos sensibles (email, tarifa/salario quedan fuera con `fields`).
 */
export async function GET(req: Request) {
  const requester = await getRequester(req);
  if (!requester) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const admin = await getAdminPB();
  const members = await admin.collection("users").getFullList({
    filter: `business="${requester.business}"`,
    sort: "name",
    fields: "id,name,role,active,avatar,job_title",
  });
  return NextResponse.json({ members });
}
