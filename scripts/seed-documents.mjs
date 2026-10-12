// Siembra documentos de demo. Uso: node scripts/seed-documents.mjs
import PocketBase from "pocketbase";

const PB_URL = process.env.NEXT_PUBLIC_PB_URL || "http://127.0.0.1:8090";
const pb = new PocketBase(PB_URL);
pb.autoCancellation(false);

// PDF mínimo válido (empieza por %PDF- para que PocketBase detecte el tipo).
function makePdf(text) {
  return new File([Buffer.from(`%PDF-1.4\n% ${text}\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF`)], "doc.pdf", { type: "application/pdf" });
}
function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

async function main() {
  await pb.collection("_superusers").authWithPassword(process.env.PB_ADMIN_EMAIL, process.env.PB_ADMIN_PASS);
  const biz = await pb.collection("businesses").getFirstListItem(`slug="demo"`);

  await pb.collection("businesses").update(biz.id, { modules: { ...biz.modules, documents: true } });
  console.log("✔ Módulo 'documents' activado");

  const existing = await pb.collection("documents").getList(1, 1, { filter: `business="${biz.id}"` });
  if (existing.totalItems > 0) {
    console.log("• Ya había documentos, no se siembran de nuevo.");
    return;
  }

  const maria = await pb.collection("users").getFirstListItem(`email="empleado@demo.mistereia"`);
  const dueno = await pb.collection("users").getFirstListItem(`email="dueno@demo.mistereia"`);

  const soon = ymd(new Date(Date.now() + 12 * 86400000)); // caduca en ~12 días
  const past = ymd(new Date(Date.now() - 20 * 86400000)); // caducado hace ~20 días

  const seeds = [
    { user: maria.id, title: "Nómina junio 2026", doc_type: "nomina", expires: "", text: "Nomina Junio" },
    { user: maria.id, title: "Contrato indefinido", doc_type: "contrato", expires: "", text: "Contrato" },
    { user: maria.id, title: "Carnet manipulador de alimentos", doc_type: "certificado", expires: soon, text: "Manipulador" },
    { user: maria.id, title: "Certificado de prevención (antiguo)", doc_type: "certificado", expires: past, text: "PRL antiguo" },
    { user: "", title: "Protocolo de seguridad del local", doc_type: "otro", expires: "", text: "Protocolo" },
  ];
  for (const s of seeds) {
    const data = { business: biz.id, title: s.title, doc_type: s.doc_type, expires: s.expires, uploaded_by: dueno.id, file: makePdf(s.text) };
    if (s.user) data.user = s.user;
    await pb.collection("documents").create(data);
  }
  console.log(`✔ ${seeds.length} documentos subidos (1 caducado, 1 caduca pronto, 1 general)`);
  console.log("\n✅ Documentos de demo listos.");
}

main().catch((e) => {
  console.error("✖", e?.response ?? e);
  process.exit(1);
});
