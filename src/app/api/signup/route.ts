import { NextResponse } from "next/server";
import { friendlyPbError } from "@/lib/pb-errors";
import { getAdminPB } from "@/lib/pb-server";
import { DEFAULT_MODULES } from "@/config/modules";

/** Convierte un nombre en un slug URL-seguro (sin acentos ni símbolos). */
function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/**
 * Alta self-service de un negocio nuevo (onboarding público).
 * Crea el negocio con sus módulos por defecto y su primer usuario (dueño).
 * Todo con el cliente admin en el servidor, ya que crear negocios/usuarios
 * está bloqueado por reglas para el público.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const businessName = String(body?.businessName ?? "").trim();
  const name = String(body?.name ?? "").trim();
  const email = String(body?.email ?? "").trim();
  const password = String(body?.password ?? "");

  if (!businessName || !name || !email) {
    return NextResponse.json({ error: "Faltan datos obligatorios" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres" }, { status: 400 });
  }

  const admin = await getAdminPB();

  // Slug único a partir del nombre del negocio.
  const base = slugify(businessName) || "negocio";
  let slug = base;
  let i = 1;
  // Busca un slug libre (máximo 50 intentos para evitar bucles).
  for (; i <= 50; i++) {
    try {
      await admin.collection("businesses").getFirstListItem(`slug="${slug}"`);
      slug = `${base}-${i}`;
    } catch {
      break; // libre
    }
  }

  let business;
  try {
    business = await admin.collection("businesses").create({
      name: businessName,
      slug,
      theme: { primary: "#7c5cff", accent: "#22d3ee" },
      modules: DEFAULT_MODULES,
      timezone: "Europe/Madrid",
      active: true,
    });
  } catch {
    return NextResponse.json({ error: "No se pudo crear el negocio" }, { status: 400 });
  }

  try {
    await admin.collection("users").create({
      name,
      email,
      password,
      passwordConfirm: password,
      role: "owner",
      job_title: "Dueño/a",
      business: business.id,
      active: true,
      emailVisibility: true,
      verified: true,
    });
  } catch (e: unknown) {
    // Si falla el usuario (p. ej. email en uso), deshacemos el negocio creado.
    try {
      await admin.collection("businesses").delete(business.id);
    } catch {
      /* nada */
    }
    return NextResponse.json({ error: friendlyPbError(e, "No se pudo crear el usuario") }, { status: 400 });
  }

  return NextResponse.json({ ok: true, slug });
}
