"use client";

import { useEffect, useRef, useState } from "react";
import { getPB } from "@/lib/pb";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";

interface Proposal {
  kind: "absence";
  type: string;
  start_date: string;
  end_date: string;
  note?: string;
}

interface Msg {
  id: number;
  from: "user" | "bot";
  text: string;
  source?: string;
  proposal?: Proposal;
  proposalState?: "pending" | "accepted" | "dismissed";
}

const TYPE_LABEL: Record<string, string> = {
  sick: "Baja por enfermedad",
  vacation: "Vacaciones",
  personal: "Asunto personal",
  other: "Ausencia",
};

const SUGGESTIONS = ["¿Cuántas horas llevo esta semana?", "Mañana estoy malo", "Quiero pedir vacaciones"];

let nextId = 1;

export default function AssistantPage() {
  const { user, business } = useAuth();
  const pb = getPB();
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: 0,
      from: "bot",
      text: "¡Hola! Soy el asistente de tu equipo 🤖. Puedo decirte cuántas horas llevas o registrar una ausencia si estás malo o quieres vacaciones. Todo lo que proponga lo confirmas tú.",
    },
  ]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(msg?: string) {
    const value = (msg ?? text).trim();
    if (!value || busy) return;
    setText("");
    setMessages((prev) => [...prev, { id: nextId++, from: "user", text: value }]);
    setBusy(true);
    try {
      const res = await apiFetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error);
      setMessages((prev) => [
        ...prev,
        {
          id: nextId++,
          from: "bot",
          text: data.reply,
          source: data.source,
          proposal: data.proposal,
          proposalState: data.proposal ? "pending" : undefined,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: nextId++, from: "bot", text: "Ahora mismo no puedo responder. Inténtalo de nuevo en un momento." },
      ]);
    } finally {
      setBusy(false);
    }
  }

  async function confirmProposal(msg: Msg) {
    if (!msg.proposal || !user || !business) return;
    try {
      await pb.collection("absences").create({
        business: business.id,
        user: user.id,
        type: msg.proposal.type,
        start_date: msg.proposal.start_date,
        end_date: msg.proposal.end_date,
        note: msg.proposal.note ?? "",
        status: "pending",
        suggested_by_ai: true,
      });
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, proposalState: "accepted" as const } : m)).concat({
          id: nextId++,
          from: "bot",
          text: "✅ Hecho. He registrado la solicitud y tu responsable la verá para aprobarla. ¡Cuídate!",
        }),
      );
    } catch {
      setMessages((prev) =>
        prev.concat({ id: nextId++, from: "bot", text: "No he podido registrar la ausencia. Inténtalo de nuevo." }),
      );
    }
  }

  function dismissProposal(msg: Msg) {
    setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, proposalState: "dismissed" } : m)));
  }

  return (
    <div className="flex h-[calc(100dvh-9rem)] flex-col rounded-[var(--radius)] border border-border bg-surface">
      <header className="flex items-center gap-3 border-b border-border p-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-lg">🤖</span>
        <div>
          <p className="font-display font-bold text-ink">Asistente IA</p>
          <p className="text-xs text-muted">Propone; tú decides. Nada se hace sin confirmación.</p>
        </div>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`flex max-w-[80%] flex-col ${m.from === "user" ? "items-end" : "items-start"}`}>
              <div
                className={`rounded-2xl px-3.5 py-2 text-sm ${
                  m.from === "user" ? "rounded-br-sm bg-primary text-on-primary" : "rounded-bl-sm bg-surface2 text-ink"
                }`}
              >
                {m.text}
              </div>
              {m.source && (
                <span className="mt-0.5 px-1 text-[10px] text-muted">
                  {m.source === "ia" ? "respuesta con IA" : "modo reglas (sin IA activa)"}
                </span>
              )}

              {m.proposal && m.proposalState === "pending" && (
                <div className="mt-2 w-full rounded-[var(--radius)] border border-primary/30 bg-primary/8 p-3">
                  <p className="text-sm font-semibold text-ink">
                    📋 {TYPE_LABEL[m.proposal.type] ?? "Ausencia"}
                  </p>
                  <p className="mt-0.5 text-sm text-muted">
                    Del <strong className="text-ink">{m.proposal.start_date}</strong> al{" "}
                    <strong className="text-ink">{m.proposal.end_date}</strong> · pendiente de aprobación del responsable
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => confirmProposal(m)}
                      className="rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-on-primary transition hover:bg-primary-strong"
                    >
                      Confirmar
                    </button>
                    <button
                      onClick={() => dismissProposal(m)}
                      className="rounded-full border border-border bg-surface px-4 py-1.5 text-sm text-ink transition hover:border-danger hover:text-danger"
                    >
                      Descartar
                    </button>
                  </div>
                </div>
              )}
              {m.proposalState === "accepted" && (
                <span className="mt-1 px-1 text-xs text-success">✔ Solicitud registrada</span>
              )}
              {m.proposalState === "dismissed" && (
                <span className="mt-1 px-1 text-xs text-muted">Propuesta descartada</span>
              )}
            </div>
          </div>
        ))}
        {busy && <p className="px-1 text-sm text-muted">El asistente está pensando…</p>}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border p-3">
        <div className="mb-2 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              disabled={busy}
              className="rounded-full border border-border bg-surface2 px-3 py-1 text-xs text-ink transition hover:border-primary disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="flex items-center gap-2"
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Escribe al asistente…"
            className="flex-1 rounded-full border border-border bg-canvas px-4 py-2.5 text-ink outline-none focus:border-primary"
          />
          <button
            type="submit"
            disabled={busy || !text.trim()}
            className="rounded-full bg-primary px-5 py-2.5 font-semibold text-on-primary transition hover:bg-primary-strong disabled:opacity-50"
          >
            Enviar
          </button>
        </form>
      </div>
    </div>
  );
}
