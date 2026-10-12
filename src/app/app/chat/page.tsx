"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RecordModel } from "pocketbase";
import { getPB } from "@/lib/pb";
import { useAuth } from "@/providers/AuthProvider";
import { fetchRoster } from "@/lib/roster";

interface Conversation extends RecordModel {
  type: "dm" | "group" | "channel";
  name: string;
  members: string[];
}
interface Message extends RecordModel {
  conversation: string;
  sender: string;
  text: string;
}
interface Member {
  id: string;
  name: string;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}
function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function ChatPage() {
  const { user, business } = useAuth();
  const pb = getPB();

  const [members, setMembers] = useState<Member[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [ready, setReady] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const userMap = useMemo(() => {
    const m = new Map<string, string>();
    members.forEach((x) => m.set(x.id, x.name));
    return m;
  }, [members]);

  // Nombre visible de una conversación (para DMs, el nombre del otro).
  const convName = useCallback(
    (c: Conversation) => {
      if (c.type !== "dm") return c.name || "Grupo";
      const other = c.members.find((id) => id !== user?.id);
      return (other && userMap.get(other)) || "Chat";
    },
    [user?.id, userMap],
  );

  // Carga inicial: compañeros + conversaciones, y asegura el canal General.
  useEffect(() => {
    if (!business || !user) return;
    let alive = true;
    (async () => {
      const [ppl, convs] = await Promise.all([
        fetchRoster(),
        pb.collection("conversations").getFullList<Conversation>({ sort: "-updated" }),
      ]);
      if (!alive) return;
      setMembers(ppl);

      let list = convs;
      const hasGeneral = convs.some((c) => c.type === "channel" && c.name === "General");
      if (!hasGeneral) {
        try {
          const general = await pb.collection("conversations").create<Conversation>({
            business: business.id,
            type: "channel",
            name: "General",
            members: ppl.map((p) => p.id),
          });
          list = [general, ...convs];
        } catch {
          /* si otro lo creó a la vez, se verá al recargar */
        }
      }
      if (!alive) return;
      setConversations(list);
      setActiveId((prev) => prev ?? list[0]?.id ?? null);
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, [pb, business, user]);

  // Carga de mensajes + suscripción en tiempo real de la conversación activa.
  useEffect(() => {
    if (!activeId) return;
    let unsub: (() => void) | undefined;
    (async () => {
      const msgs = await pb.collection("messages").getFullList<Message>({
        filter: `conversation="${activeId}"`,
        sort: "created",
      });
      setMessages(msgs);
      unsub = await pb.collection("messages").subscribe<Message>(
        "*",
        (e) => {
          if (e.action === "create" && e.record.conversation === activeId) {
            setMessages((prev) => (prev.some((m) => m.id === e.record.id) ? prev : [...prev, e.record]));
          }
        },
        { filter: `conversation="${activeId}"` },
      );
    })();
    return () => {
      if (unsub) unsub();
    };
  }, [activeId, pb]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (!value || !activeId || !user || !business) return;
    setText("");
    try {
      const created = await pb.collection("messages").create<Message>({
        business: business.id,
        conversation: activeId,
        sender: user.id,
        text: value,
      });
      setMessages((prev) => (prev.some((m) => m.id === created.id) ? prev : [...prev, created]));
    } catch {
      setText(value); // restaura si falla
    }
  }

  async function openDM(other: Member) {
    if (!user || !business) return;
    setShowNew(false);
    const existing = conversations.find(
      (c) => c.type === "dm" && c.members.includes(other.id) && c.members.includes(user.id),
    );
    if (existing) {
      setActiveId(existing.id);
      return;
    }
    const dm = await pb.collection("conversations").create<Conversation>({
      business: business.id,
      type: "dm",
      name: "",
      members: [user.id, other.id],
    });
    setConversations((prev) => [dm, ...prev]);
    setActiveId(dm.id);
  }

  const active = conversations.find((c) => c.id === activeId) ?? null;

  return (
    <div className="flex h-[calc(100dvh-9rem)] gap-4">
      {/* Lista de conversaciones */}
      <aside
        className={`${active ? "hidden md:flex" : "flex"} w-full flex-col rounded-[var(--radius)] border border-border bg-surface md:w-72`}
      >
        <div className="flex items-center justify-between border-b border-border p-3">
          <h1 className="font-display font-bold text-ink">Chat</h1>
          <button
            onClick={() => setShowNew((s) => !s)}
            className="rounded-full bg-primary px-3 py-1.5 text-sm font-semibold text-on-primary transition hover:bg-primary-strong"
          >
            {showNew ? "Cerrar" : "+ Nuevo"}
          </button>
        </div>

        {showNew && (
          <div className="border-b border-border p-2">
            <p className="px-2 py-1 text-xs uppercase tracking-wide text-muted">Iniciar chat con…</p>
            {members
              .filter((m) => m.id !== user?.id)
              .map((m) => (
                <button
                  key={m.id}
                  onClick={() => openDM(m)}
                  className="flex w-full items-center gap-2 rounded-[var(--radius)] px-2 py-2 text-left text-sm text-ink transition hover:bg-surface2"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                    {initials(m.name)}
                  </span>
                  {m.name}
                </button>
              ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-2">
          {!ready ? (
            <p className="p-2 text-sm text-muted">Cargando…</p>
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={`flex w-full items-center gap-3 rounded-[var(--radius)] px-2 py-2.5 text-left transition ${
                  c.id === activeId ? "bg-primary/12" : "hover:bg-surface2"
                }`}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                  {c.type === "channel" ? "#" : initials(convName(c))}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-medium text-ink">{convName(c)}</span>
                  <span className="block truncate text-xs text-muted">
                    {c.type === "channel" ? "Canal del equipo" : c.type === "group" ? "Grupo" : "Mensaje directo"}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Panel de mensajes */}
      <section
        className={`${active ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col rounded-[var(--radius)] border border-border bg-surface`}
      >
        {!active ? (
          <div className="flex flex-1 items-center justify-center text-muted">
            Elige una conversación para empezar a chatear.
          </div>
        ) : (
          <>
            <header className="flex items-center gap-3 border-b border-border p-3">
              <button onClick={() => setActiveId(null)} className="text-muted md:hidden" aria-label="Volver">
                ←
              </button>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                {active.type === "channel" ? "#" : initials(convName(active))}
              </span>
              <div>
                <p className="font-display font-bold text-ink">{convName(active)}</p>
                <p className="text-xs text-muted">
                  {active.type === "channel" ? `${active.members.length} miembros` : "Mensaje directo"}
                </p>
              </div>
            </header>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {messages.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted">Aún no hay mensajes. ¡Escribe el primero!</p>
              ) : (
                messages.map((m) => {
                  const mine = m.sender === user?.id;
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[75%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
                        {!mine && active.type !== "dm" && (
                          <span className="mb-0.5 px-1 text-xs font-medium text-muted">
                            {userMap.get(m.sender) ?? "Alguien"}
                          </span>
                        )}
                        <div
                          className={`rounded-2xl px-3.5 py-2 text-sm ${
                            mine ? "rounded-br-sm bg-primary text-on-primary" : "rounded-bl-sm bg-surface2 text-ink"
                          }`}
                        >
                          {m.text}
                        </div>
                        <span className="mt-0.5 px-1 text-[10px] text-muted">{fmtTime(m.created)}</span>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>

            <form onSubmit={send} className="flex items-center gap-2 border-t border-border p-3">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Escribe un mensaje…"
                className="flex-1 rounded-full border border-border bg-canvas px-4 py-2.5 text-ink outline-none focus:border-primary"
              />
              <button
                type="submit"
                disabled={!text.trim()}
                className="rounded-full bg-primary px-5 py-2.5 font-semibold text-on-primary transition hover:bg-primary-strong disabled:opacity-50"
              >
                Enviar
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
