// Siembra proyectos de demo e imputa fichajes de María. Uso: node scripts/seed-projects.mjs
import PocketBase from "pocketbase";

const PB_URL = process.env.NEXT_PUBLIC_PB_URL || "http://127.0.0.1:8090";
const pb = new PocketBase(PB_URL);
pb.autoCancellation(false);

async function ensureProject(bizId, name, client, color) {
  try {
    return await pb.collection("projects").getFirstListItem(`business="${bizId}" && name="${name}"`);
  } catch {
    return await pb.collection("projects").create({ business: bizId, name, client, color, active: true });
  }
}

async function main() {
  await pb.collection("_superusers").authWithPassword(process.env.PB_ADMIN_EMAIL, process.env.PB_ADMIN_PASS);
  const biz = await pb.collection("businesses").getFirstListItem(`slug="demo"`);

  await pb.collection("businesses").update(biz.id, { modules: { ...biz.modules, projects: true } });
  console.log("✔ Módulo 'projects' activado");

  const a = await ensureProject(biz.id, "Reforma cocina", "Familia García", "#7c5cff");
  const b = await ensureProject(biz.id, "Montaje tienda", "Bar Pepe", "#22d3ee");
  console.log("✔ Proyectos:", a.name, "/", b.name);

  const maria = await pb.collection("users").getFirstListItem(`email="empleado@demo.mistereia"`);
  const ins = await pb.collection("time_entries").getFullList({
    filter: `user="${maria.id}" && type="in"`,
    sort: "at",
  });
  let n = 0;
  for (let i = 0; i < ins.length; i++) {
    const project = i < Math.ceil(ins.length / 2) ? a.id : b.id;
    await pb.collection("time_entries").update(ins[i].id, { project });
    n++;
  }
  console.log(`✔ ${n} jornadas de María imputadas (primera mitad a «${a.name}», resto a «${b.name}»)`);
  console.log("\n✅ Proyectos de demo listos.");
}

main().catch((e) => {
  console.error("✖", e?.response ?? e);
  process.exit(1);
});
