import PocketBase, { type RecordModel } from "pocketbase";
import type { Role } from "@/config/roles";

const PB_URL = process.env.NEXT_PUBLIC_PB_URL ?? "http://127.0.0.1:8090";

export type Requester = RecordModel & { role: Role; business: string; name: string };

/**
 * Cliente PocketBase autenticado como administrador. SOLO se usa en el servidor
 * (rutas API); las credenciales nunca llegan al navegador.
 */
export async function getAdminPB(): Promise<PocketBase> {
  const pb = new PocketBase(PB_URL);
  pb.autoCancellation(false);
  await pb
    .collection("_superusers")
    .authWithPassword(process.env.PB_ADMIN_EMAIL as string, process.env.PB_ADMIN_PASS as string);
  return pb;
}

/**
 * Identifica al usuario que hace la petición a partir de su token (cabecera
 * Authorization). Devuelve el registro fresco desde la BD (no se puede falsear
 * el rol) o null si el token no es válido.
 */
export async function getRequester(req: Request): Promise<Requester | null> {
  const token = req.headers.get("authorization") ?? "";
  if (!token) return null;
  const pb = new PocketBase(PB_URL);
  pb.authStore.save(token, null);
  try {
    const auth = await pb.collection("users").authRefresh();
    return auth.record as unknown as Requester;
  } catch {
    return null;
  }
}
