// Siembra datos de demo para la Fase 2 (turnos + fichajes que disparan anti-burnout).
// Uso: node scripts/seed-fase2.mjs

import PocketBase from "pocketbase";

const PB_URL = process.env.NEXT_PUBLIC_PB_URL || "http://127.0.0.1:8090";
const ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL; // define PB_ADMIN_EMAIL / PB_ADMIN_PASS en .env.local o en el entorno
const ADMIN_PASS = process.env.PB_ADMIN_PASS;

const pb = new PocketBase(PB_URL);
pb.autoCancellation(false);

function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}
function mondayOf(d) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

async function main() {
  await pb.collection("_superusers").authWithPassword(ADMIN_EMAIL, ADMIN_PASS);
  const biz = await pb.collection("businesses").getFirstListItem(`slug="demo"`);

  // 1) Activar módulos shifts + burnout
  const modules = { ...biz.modules, shifts: true, burnout: true };
  await pb.collection("businesses").update(biz.id, { modules });
  console.log("✔ Módulos 'shifts' y 'burnout' activados");

  const users = await pb.collection("users").getFullList({ filter: `business="${biz.id}"` });
  const byEmail = Object.fromEntries(users.map((u) => [u.email, u]));
  const maria = byEmail["empleado@demo.mistereia"];
  const luis = byEmail["responsable@demo.mistereia"];
  const carlos = byEmail["carlos@demo.mistereia"];

  // 2) Turnos de la semana actual (idempotente: borra los existentes de la semana)
  const mon = mondayOf(new Date());
  const weekDates = Array.from({ length: 7 }, (_, i) => ymd(addDays(mon, i)));
  const existing = await pb.collection("shifts").getFullList({
    filter: `business="${biz.id}" && date>="${weekDates[0]}" && date<="${weekDates[6]}"`,
  });
  for (const s of existing) await pb.collection("shifts").delete(s.id);

  const plan = [
    { user: maria, days: [0, 1, 2, 3, 4], start: "08:00", end: "16:00", note: "Mostrador" },
    { user: luis, days: [0, 2, 4], start: "10:00", end: "18:00", note: "Encargado" },
    { user: carlos, days: [1, 3, 5], start: "07:00", end: "13:00", note: "Reparto" },
  ];
  let n = 0;
  for (const p of plan) {
    if (!p.user) continue;
    for (const d of p.days) {
      await pb.collection("shifts").create({
        business: biz.id,
        user: p.user.id,
        date: weekDates[d],
        start_time: p.start,
        end_time: p.end,
        note: p.note,
        created_by: byEmail["dueno@demo.mistereia"]?.id,
      });
      n++;
    }
  }
  console.log(`✔ ${n} turnos creados para la semana`);

  // 3) Fichajes de María: 6 días seguidos de jornadas largas (dispara anti-burnout)
  if (maria) {
    // Borra fichajes previos de María de los últimos 8 días para no acumular
    const since = new Date(Date.now() - 8 * 86400000).toISOString();
    const old = await pb.collection("time_entries").getFullList({ filter: `user="${maria.id}" && at>="${since}"` });
    for (const e of old) await pb.collection("time_entries").delete(e.id);

    for (let i = 6; i >= 1; i--) {
      const day = addDays(new Date(), -i);
      const mk = (h, m) => {
        const x = new Date(day);
        x.setHours(h, m, 0, 0);
        return x.toISOString();
      };
      // Entrada 08:00 → salida 19:00 (11 h), con una pausa de 30 min
      await pb.collection("time_entries").create({ business: biz.id, user: maria.id, type: "in", method: "manual", at: mk(8, 0) });
      await pb.collection("time_entries").create({ business: biz.id, user: maria.id, type: "break_start", method: "manual", at: mk(13, 0) });
      await pb.collection("time_entries").create({ business: biz.id, user: maria.id, type: "break_end", method: "manual", at: mk(13, 30) });
      await pb.collection("time_entries").create({ business: biz.id, user: maria.id, type: "out", method: "manual", at: mk(19, 0) });
    }
    console.log("✔ Fichajes de María: 6 jornadas largas seguidas (para anti-burnout)");
  }

  console.log("\n✅ Datos de Fase 2 listos.");
}

main().catch((err) => {
  console.error("✖ Error:", err?.response ?? err);
  process.exit(1);
});
