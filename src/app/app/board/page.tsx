"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getPB } from "@/lib/pb";
import { useAuth } from "@/providers/AuthProvider";
import { fetchRoster } from "@/lib/roster";

interface Announcement {
  id: string;
  title: string;
  body: string;
  author?: string;
  pinned?: boolean;
  created: string;
}

function fmtWhen(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}

export default function BoardPage() {
  const { user, business } = useAuth();
  const pb = getPB();
  const canPost = user?.role === "owner" || user?.role === "manager";

  const [list, setList] = useState<Announcement[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");

  const load = useCallback(async () => {
    if (!business) return;
    const [items, roster] = await Promise.all([
      pb.collection("announcements").getFullList<Announcement>({ filter: `business="${business.id}"`, sort: "-pinned,-created" }),
      fetchRoster(),
    ]);
    setList(items);
    setNames(new Map(roster.map((m) => [m.id, m.name])));
    setLoading(false);
  }, [pb, business]);

  useEffect(() => {
    load();
  }, [load]);

  const authorName = useMemo(() => (id?: string) => (id ? names.get(id) ?? "Dirección" : "Dirección"), [names]);

  async function publish(e: React.FormEvent) {
    e.preventDefault();
    if (!business || !user || !title.trim() || !body.trim()) return;
    setSaving(true);
    try {
      await pb.collection("announcements").create({ business: business.id, author: user.id, title: title.trim(), body: body.trim(), pinned });
      setTitle("");
      setBody("");
      setPinned(false);
      setShowForm(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function togglePin(a: Announcement) {
    await pb.collection("announcements").update(a.id, { pinned: !a.pinned });
    await load();
  }
  async function remove(id: string) {
    await pb.collection("announcements").delete(id);
    await load();
  }
  function startEdit(a: Announcement) {
    setEditingId(a.id);
    setEditTitle(a.title);
    setEditBody(a.body);
  }
  async function saveEdit() {
    if (!editingId) return;
    setSaving(true);
    try {
      await pb.collection("announcements").update(editingId, { title: editTitle.trim(), body: editBody.trim() });
      setEditingId(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Tablón de anuncios</h1>
          <p className="text-muted">Comunicados de la empresa para todo el equipo.</p>
        </div>
        {canPost && (
          <button onClick={() => setShowForm((s) => !s)} className="rounded-[var(--radius)] bg-primary px-4 py-2.5 font-semibold text-on-primary transition hover:bg-primary-strong">
            {showForm ? "Cancelar" : "+ Publicar"}
          </button>
        )}
      </div>

      {canPost && showForm && (
        <form onSubmit={publish} className="flex flex-col gap-3 rounded-[var(--radius)] border border-border bg-surface p-5">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título del anuncio" className="rounded-[var(--radius)] border border-border bg-canvas px-3 py-2 font-medium text-ink outline-none focus:border-primary" />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="Escribe el comunicado…" className="rounded-[var(--radius)] border border-border bg-canvas px-3 py-2 text-ink outline-none focus:border-primary" />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} className="h-4 w-4 accent-[var(--brand-primary)]" />
              📌 Fijar arriba
            </label>
            <button type="submit" disabled={saving} className="rounded-[var(--radius)] bg-primary px-4 py-2 font-semibold text-on-primary transition hover:bg-primary-strong disabled:opacity-60">
              {saving ? "Publicando…" : "Publicar anuncio"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-muted">Cargando…</p>
      ) : list.length === 0 ? (
        <p className="rounded-[var(--radius)] border border-border bg-surface p-5 text-muted">No hay anuncios todavía.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {list.map((a) => (
            <div key={a.id} className={`rounded-[var(--radius)] border bg-surface p-5 ${a.pinned ? "border-primary/40" : "border-border"}`}>
              {editingId === a.id ? (
                <div className="flex flex-col gap-3">
                  <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="rounded-[var(--radius)] border border-border bg-canvas px-3 py-2 font-medium text-ink outline-none focus:border-primary" />
                  <textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={4} className="rounded-[var(--radius)] border border-border bg-canvas px-3 py-2 text-ink outline-none focus:border-primary" />
                  <div className="flex gap-2">
                    <button onClick={saveEdit} disabled={saving} className="rounded-[var(--radius)] bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition hover:bg-primary-strong disabled:opacity-60">Guardar</button>
                    <button onClick={() => setEditingId(null)} className="rounded-[var(--radius)] border border-border bg-surface px-4 py-2 text-sm text-ink">Cancelar</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {a.pinned && <span title="Fijado">📌</span>}
                      <h2 className="font-display text-lg font-bold text-ink">{a.title}</h2>
                    </div>
                    {canPost && (
                      <div className="flex shrink-0 gap-2">
                        <button onClick={() => togglePin(a)} className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-ink transition hover:border-primary">{a.pinned ? "Desfijar" : "Fijar"}</button>
                        <button onClick={() => startEdit(a)} className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-ink transition hover:border-primary">Editar</button>
                        <button onClick={() => remove(a.id)} className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-ink transition hover:border-danger hover:text-danger">Borrar</button>
                      </div>
                    )}
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-ink">{a.body}</p>
                  <p className="mt-3 text-xs text-muted">{authorName(a.author)} · {fmtWhen(a.created)}</p>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
