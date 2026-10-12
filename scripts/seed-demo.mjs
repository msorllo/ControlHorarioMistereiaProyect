// Aprovisiona un negocio DEMO con usuarios de prueba (idempotente).
// Uso:  node scripts/seed-demo.mjs
//
// Reutilizable como base del futuro "alta de negocio nuevo": crea el registro
// del negocio con sus módulos por defecto y sus primeros usuarios (dueño, etc.).

import PocketBase from "pocketbase";

const PB_URL = process.env.NEXT_PUBLIC_PB_URL || "http://127.0.0.1:8090";
const ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL; // define PB_ADMIN_EMAIL / PB_ADMIN_PASS en .env.local o en el entorno
const ADMIN_PASS = process.env.PB_ADMIN_PASS;

// Módulos activados por defecto en un negocio nuevo (espejo de src/config/modules.ts).
const DEFAULT_MODULES = {
  time_tracking: true,
  chat: true,
  shifts: false,
  absences: false,
  geofencing: false,
  ai_assistant: false,
  burnout: false,
  payroll_export: false,
  projects: false,
  gamification: false,
  documents: false,
  announcements: false,
};

const pb = new PocketBase(PB_URL);
pb.autoCancellation(false);

async function main() {
  await pb.collection("_superusers").authWithPassword(ADMIN_EMAIL, ADMIN_PASS);
  console.log("✔ Autenticado como super-administrador");

  // --- Negocio demo (idempotente por slug) ---
  let business;
  try {
    business = await pb.collection("businesses").getFirstListItem(`slug="demo"`);
    console.log("• Negocio demo ya existía:", business.name);
  } catch {
    business = await pb.collection("businesses").create({
      name: "Panadería Demo",
      slug: "demo",
      theme: { primary: "#7c5cff", accent: "#22d3ee" },
      modules: DEFAULT_MODULES,
      timezone: "Europe/Madrid",
      active: true,
    });
    console.log("✔ Negocio demo creado:", business.name);
  }

  // --- Usuarios demo (idempotente por email) ---
  const users = [
    { email: "dueno@demo.mistereia", name: "Ana (Dueña)", role: "owner", job_title: "Propietaria" },
    { email: "responsable@demo.mistereia", name: "Luis (Responsable)", role: "manager", job_title: "Encargado de turno" },
    { email: "empleado@demo.mistereia", name: "María (Empleada)", role: "employee", job_title: "Dependienta" },
  ];
  const PASSWORD = "mistereia123";

  for (const u of users) {
    try {
      const existing = await pb.collection("users").getFirstListItem(`email="${u.email}"`);
      console.log("• Usuario ya existía:", existing.email);
    } catch {
      await pb.collection("users").create({
        ...u,
        password: PASSWORD,
        passwordConfirm: PASSWORD,
        business: business.id,
        active: true,
        emailVisibility: true,
        verified: true,
      });
      console.log(`✔ Usuario creado: ${u.email}  (contraseña: ${PASSWORD})`);
    }
  }

  console.log("\n✅ Datos demo listos.");
  console.log("   Negocio:", business.name, `(slug: ${business.slug})`);
  console.log("   Accesos de prueba (contraseña", PASSWORD + "):");
  users.forEach((u) => console.log(`     - ${u.role.padEnd(9)} ${u.email}`));
}

main().catch((err) => {
  console.error("✖ Error al sembrar datos:", err?.response ?? err);
  process.exit(1);
});
