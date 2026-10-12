"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getPB } from "@/lib/pb";
import { useAuth } from "@/providers/AuthProvider";
import { fetchRoster, type RosterMember } from "@/lib/roster";

interface DocRecord {
  id: string;
  collectionId: string;
  user?: string;
  title: string;
  doc_type: string;
  file: string;
  expires?: string;
  created: string;
}

const TYPE_META: Record<string, { label: string; icon: string }> = {
  nomina: { label: "Nómina", icon: "💶" },
  contrato: { label: "Contrato", icon: "📝" },
  certificado: { label: "Certificado", icon: "🎓" },
  otro: { label: "Documento", icon: "📄" },
};

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

export default function DocumentsPage() {
  const { user, business } = useAuth();
  const pb = getPB();
  const canManage = user?.role === "owner" || user?.role === "manager";

  const [docs, setDocs] = useState<DocRecord[]>([]);
  const [members, setMembers] = useState<RosterMember[]>([]);
  const [fileToken, setFileToken] = useState("");
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState("nomina");
  const [targetUser, setTargetUser] = useState("");
  const [expires, setExpires] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!business) return;
    const [items, roster, token] = await Promise.all([
      pb.collection("documents").getFullList<DocRecord>({ filter: `business="${business.id}"`, sort: "-created" }),
      fetchRoster(),
      pb.files.getToken().catch(() => ""),
    ]);
    setDocs(items);
    setMembers(roster);
    setFileToken(token);
    setLoading(false);
  }, [pb, business]);

  useEffect(() => {
    load();
  }, [load]);

  const nameOf = useMemo(() => {
    const map = new Map(members.map((m) => [m.id, m.name]));
    return (id?: string) => (id ? map.get(id) ?? "Empleado" : "Todo el equipo");
  }, [members]);

  function downloadUrl(d: DocRecord) {
    return pb.files.getURL(d, d.file, fileToken ? { token: fileToken } : {});
  }

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!business || !user || !title.trim() || !file) {
      setError("Pon un título y elige un archivo (PDF o imagen).");
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("business", business.id);
      if (targetUser) fd.append("user", targetUser);
      fd.append("title", title.trim());
      fd.append("doc_type", docType);
      fd.append("expires", expires);
      fd.append("uploaded_by", user.id);
      fd.append("file", file);
      await pb.collection("documents").create(fd);
      setTitle("");
      setExpires("");
      setTargetUser("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setShowForm(false);
      await load();
    } catch (err) {
      const data = (err as { response?: { data?: Record<string, { message?: string }> } })?.response?.data;
      const msg = data ? Object.values(data).map((d) => d?.message).filter(Boolean).join(" ") : "No se pudo subir el documento";
      setError(msg || "No se pudo subir el documento");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    await pb.collection("documents").delete(id);
    await load();
  }

  const today = ymd(new Date());
  const soon = ymd(new Date(Date.now() + 30 * 86_400_000));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Documentos</h1>
          <p className="text-muted">{canManage ? "Nóminas, contratos y certificados de tu equipo, con avisos de caducidad." : "Tus documentos: nóminas, contratos y certificados."}</p>
        </div>
        {canManage && (
          <button onClick={() => setShowForm((s) => !s)} className="rounded-[var(--radius)] bg-primary px-4 py-2.5 font-semibold text-on-primary transition hover:bg-primary-strong">
            {showForm ? "Cancelar" : "+ Subir documento"}
          </button>
        )}
      </div>

      {canManage && showForm && (
        <form onSubmit={upload} className="grid gap-3 rounded-[var(--radius)] border border-border bg-surface p-5 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-ink">Título</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="p. ej. Nómina julio 2026" className="rounded-[var(--radius)] border border-border bg-canvas px-3 py-2 text-ink outline-none focus:border-primary" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-ink">Tipo</span>
            <select value={docType} onChange={(e) => setDocType(e.target.value)} className="rounded-[var(--radius)] border border-border bg-canvas px-3 py-2 text-ink outline-none focus:border-primary">
              <option value="nomina">Nómina</option>
              <option value="contrato">Contrato</option>
              <option value="certificado">Certificado</option>
              <option value="otro">Otro</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-ink">Para</span>
            <select value={targetUser} onChange={(e) => setTargetUser(e.target.value)} className="rounded-[var(--radius)] border border-border bg-canvas px-3 py-2 text-ink outline-none focus:border-primary">
              <option value="">Todo el equipo (general)</option>
              {members.filter((m) => m.active !== false).map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-ink">Caduca (opcional)</span>
            <input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} className="rounded-[var(--radius)] border border-border bg-canvas px-3 py-2 text-ink outline-none focus:border-primary" />
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="font-medium text-ink">Archivo (PDF, PNG o JPG · máx. 10 MB)</span>
            <input ref={fileInputRef} type="file" accept="application/pdf,image/png,image/jpeg" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="rounded-[var(--radius)] border border-border bg-canvas px-3 py-2 text-ink outline-none file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1 file:text-on-primary" />
          </label>
          {error && <p className="sm:col-span-2 rounded-[var(--radius)] border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
          <div className="sm:col-span-2">
            <button type="submit" disabled={saving} className="rounded-[var(--radius)] bg-primary px-4 py-2 font-semibold text-on-primary transition hover:bg-primary-strong disabled:opacity-60">
              {saving ? "Subiendo…" : "Subir documento"}
            </button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-[var(--radius)] border border-border bg-surface">
        {loading ? (
          <p className="p-5 text-muted">Cargando…</p>
        ) : docs.length === 0 ? (
          <p className="p-5 text-muted">No hay documentos todavía.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {docs.map((d) => {
              const meta = TYPE_META[d.doc_type] ?? TYPE_META.otro;
              const expired = d.expires && d.expires < today;
              const expiringSoon = d.expires && !expired && d.expires <= soon;
              return (
                <li key={d.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="text-2xl">{meta.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-ink">{d.title}</p>
                      <span className="rounded-full bg-surface2 px-2 py-0.5 text-xs text-muted">{meta.label}</span>
                      {expired && <span className="rounded-full bg-danger/15 px-2 py-0.5 text-xs font-medium text-danger">Caducado {d.expires}</span>}
                      {expiringSoon && <span className="rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning">Caduca pronto {d.expires}</span>}
                    </div>
                    <p className="text-xs text-muted">{nameOf(d.user)}</p>
                  </div>
                  <a href={downloadUrl(d)} target="_blank" rel="noopener noreferrer" className="rounded-full bg-primary px-3 py-1.5 text-sm font-semibold text-on-primary transition hover:bg-primary-strong">Descargar</a>
                  {canManage && (
                    <button onClick={() => remove(d.id)} className="rounded-full border border-border bg-surface px-2.5 py-1.5 text-xs text-ink transition hover:border-danger hover:text-danger">Borrar</button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
