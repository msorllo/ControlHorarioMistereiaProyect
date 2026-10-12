import { NextResponse } from "next/server";
import { getAdminPB, getRequester } from "@/lib/pb-server";
import { aiComplete, extractJSON, type AIConfig } from "@/lib/ai";
import { computeWorkedMs, fmtDuration, heuristicIntent, startOfWeekISO, type Intent } from "@/lib/assistant-core";

/**
 * Asistente IA del equipo.
 * Entrada:  { message: string }
 * Salida:   { reply: string, source: "ia"|"reglas",
 *             proposal?: { kind: "absence", type, start_date, end_date, note } }
 *
 * La IA solo PROPONE acciones; el usuario las confirma en la interfaz
 * y los responsables las aprueban (nunca se ejecuta nada solo).
 */

export async function POST(req: Request) {
  const requester = await getRequester(req);
  if (!requester) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const message = String(body?.message ?? "").trim();
  if (!message) return NextResponse.json({ error: "Mensaje vacío" }, { status: 400 });

  const admin = await getAdminPB();

  // Config de IA del negocio (multiproveedor, elegible por cliente)
  let aiConfig: AIConfig | null = null;
  try {
    const biz = await admin.collection("businesses").getOne(requester.business);
    aiConfig = (biz.ai as AIConfig) ?? null;
  } catch {
    /* sin negocio → seguirá en modo reglas */
  }

  const today = new Date().toISOString().slice(0, 10);
  const system = `Eres el asistente de RRHH de una app de control horario española. Analiza el mensaje del empleado y responde SOLO con un JSON válido, sin texto adicional, con esta forma:
{"intent":"ausencia"|"horas"|"charla","reply":"respuesta breve y cercana en español de España","absence":{"type":"sick"|"vacation"|"personal"|"other","start_date":"YYYY-MM-DD","end_date":"YYYY-MM-DD","note":"resumen"}}
Reglas: incluye "absence" SOLO si intent es "ausencia". Hoy es ${today}. Si dice "mañana", usa la fecha de mañana. Si no da fechas, usa mañana como inicio y fin. "reply" debe explicar qué propones (p. ej. registrar la ausencia para que la apruebe su responsable). Nunca inventes datos del negocio.`;

  const raw = await aiComplete(system, message, aiConfig);
  const parsed = extractJSON<Intent>(raw);
  const intent: Intent = parsed?.intent ? parsed : heuristicIntent(message);
  const source = parsed?.intent ? "ia" : "reglas";

  // --- Intención: consultar horas (datos REALES, calculados por el servidor) ---
  if (intent.intent === "horas") {
    const entries = await admin.collection("time_entries").getFullList<{ type: string; at: string }>({
      filter: `user="${requester.id}" && at>="${startOfWeekISO()}"`,
      sort: "at",
    });
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEntries = entries.filter((e) => new Date(e.at) >= todayStart);
    const reply = `Esta semana llevas ${fmtDuration(computeWorkedMs(entries))} trabajadas (hoy: ${fmtDuration(
      computeWorkedMs(todayEntries),
    )}, con ${todayEntries.length} fichajes). ¿Necesitas algo más?`;
    return NextResponse.json({ reply, source });
  }

  // --- Intención: ausencia → PROPUESTA (el usuario confirma en la UI) ---
  if (intent.intent === "ausencia") {
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const abs = intent.absence ?? {};
    const type = ["sick", "vacation", "personal", "other"].includes(abs.type ?? "") ? abs.type! : "sick";
    const start = /^\d{4}-\d{2}-\d{2}$/.test(abs.start_date ?? "") ? abs.start_date! : tomorrow;
    const end = /^\d{4}-\d{2}-\d{2}$/.test(abs.end_date ?? "") && abs.end_date! >= start ? abs.end_date! : start;
    const typeLabel: Record<string, string> = { sick: "baja por enfermedad", vacation: "vacaciones", personal: "asunto personal", other: "ausencia" };
    return NextResponse.json({
      reply:
        intent.reply ??
        `Siento que no te encuentres bien 😔. Puedo registrar una ${typeLabel[type]} del ${start} al ${end} y avisar a tu responsable para que la apruebe. ¿Lo confirmo?`,
      source,
      proposal: { kind: "absence", type, start_date: start, end_date: end, note: abs.note ?? message.slice(0, 200) },
    });
  }

  // --- Charla general ---
  return NextResponse.json({
    reply:
      intent.reply ??
      "Puedo ayudarte con tus horas trabajadas («¿cuántas horas llevo esta semana?») o registrar una ausencia («mañana estoy malo»). ¿Qué necesitas?",
    source,
  });
}
