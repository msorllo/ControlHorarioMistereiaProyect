import { col, initStore, persist, unpersist, type Rec } from "./store";
import { seedDemo } from "./seed";
import { newId, hashPassword } from "./util";

/**
 * Cliente "PocketBase local" para el modo demo. Imita la parte de la API de
 * PocketBase que usa la app (collection().getFullList/getOne/create/update/
 * delete/subscribe/authWithPassword/authRefresh, authStore y files) pero lee y
 * escribe en el navegador del visitante. No hay servidor ni costes.
 */

const AUTH_KEY = "mistereia_demo_auth";
const SECRET_FIELDS = ["password_hash", "salt"];

const clean = (r: Rec): Rec => {
  const c = { ...r };
  for (const f of SECRET_FIELDS) delete c[f];
  return c;
};

export { newId, hashPassword };

// ---------------------------------------------------------------- filtros / orden
type Clause = { field: string; op: string; value: string | number | boolean };

function parseFilter(filter?: string): Clause[] {
  if (!filter) return [];
  return filter
    .split("&&")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const m = part.match(/^([\w.]+)\s*(>=|<=|!=|=|>|<)\s*(?:"([^"]*)"|(true|false)|(-?\d+(?:\.\d+)?))$/);
      if (!m) throw new Error(`Filtro no soportado en modo demo: ${part}`);
      const value = m[3] !== undefined ? m[3] : m[4] !== undefined ? m[4] === "true" : Number(m[5]);
      return { field: m[1], op: m[2], value };
    });
}

function matches(rec: Rec, clauses: Clause[]): boolean {
  return clauses.every(({ field, op, value }) => {
    let v = rec[field] as unknown;
    if (Array.isArray(v)) v = v.includes(value) ? value : undefined;
    if (v === undefined || v === null) v = typeof value === "string" ? "" : typeof value === "boolean" ? false : 0;
    switch (op) {
      case "=":
        return v === value;
      case "!=":
        return v !== value;
      case ">=":
        return (v as string | number) >= (value as string | number);
      case "<=":
        return (v as string | number) <= (value as string | number);
      case ">":
        return (v as string | number) > (value as string | number);
      case "<":
        return (v as string | number) < (value as string | number);
    }
    return false;
  });
}

function sortRecords(list: Rec[], sort?: string): Rec[] {
  if (!sort) return list;
  const keys = sort
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [...list].sort((a, b) => {
    for (const k of keys) {
      const desc = k.startsWith("-");
      const f = k.replace(/^[-+]/, "");
      const x = (a[f] ?? "") as string | number | boolean;
      const y = (b[f] ?? "") as string | number | boolean;
      if (x === y) continue;
      const r = x > y ? 1 : -1;
      return desc ? -r : r;
    }
    return 0;
  });
}

// ---------------------------------------------------------------- authStore
type Listener = (token: string, record: Rec | null) => void;

class LocalAuthStore {
  token = "";
  record: Rec | null = null;
  private listeners = new Set<Listener>();

  constructor() {
    try {
      const raw = typeof localStorage !== "undefined" ? localStorage.getItem(AUTH_KEY) : null;
      if (raw) {
        const s = JSON.parse(raw);
        this.token = s.token ?? "";
        this.record = s.record ?? null;
      }
    } catch {
      /* sin almacenamiento */
    }
  }
  get isValid() {
    return !!this.token && !!this.record;
  }
  save(token: string, record: Rec | null) {
    this.token = token;
    this.record = record;
    try {
      localStorage.setItem(AUTH_KEY, JSON.stringify({ token, record }));
    } catch {
      /* nada */
    }
    this.listeners.forEach((l) => l(token, record));
  }
  clear() {
    this.token = "";
    this.record = null;
    try {
      localStorage.removeItem(AUTH_KEY);
    } catch {
      /* nada */
    }
    this.listeners.forEach((l) => l("", null));
  }
  onChange(cb: Listener) {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }
}

// ---------------------------------------------------------------- eventos
type SubEvent = { action: "create" | "update" | "delete"; record: Rec };
const subs = new Map<string, Set<{ cb: (e: SubEvent) => void; clauses: Clause[] }>>();

function emit(c: string, e: SubEvent) {
  subs.get(c)?.forEach(({ cb, clauses }) => {
    if (matches(e.record, clauses)) cb(e);
  });
}

// ---------------------------------------------------------------- colección
interface ListOpts {
  filter?: string;
  sort?: string;
}

/** Reglas de visibilidad equivalentes a las de PocketBase que importan en la UI. */
function visibleTo(c: string, rec: Rec, me: Rec | null): boolean {
  if (!me) return false;
  if (c === "conversations") return Array.isArray(rec.members) && rec.members.includes(me.id);
  if (c === "documents" && me.role === "employee") return !rec.user || rec.user === me.id;
  return true;
}

function toPlain(body: Record<string, unknown> | FormData): Record<string, unknown> {
  if (!(body instanceof FormData)) return { ...body };
  const out: Record<string, unknown> = {};
  body.forEach((v, k) => {
    if (v instanceof File) {
      out[k] = v.name;
      out[`__blob_${k}`] = v;
    } else {
      out[k] = v;
    }
  });
  return out;
}

class LocalCollection {
  constructor(
    private name: string,
    private store: LocalAuthStore,
  ) {}

  private async ready() {
    await initStore(seedDemo);
  }

  async getFullList<T = Rec>(opts: ListOpts = {}): Promise<T[]> {
    await this.ready();
    const clauses = parseFilter(opts.filter);
    const list = [...col(this.name).values()].filter(
      (r) => matches(r, clauses) && visibleTo(this.name, r, this.store.record),
    );
    return sortRecords(list, opts.sort).map(clean) as T[];
  }

  async getOne<T = Rec>(id: string): Promise<T> {
    await this.ready();
    const r = col(this.name).get(id);
    if (!r) throw new Error("Registro no encontrado");
    return clean(r) as T;
  }

  async getFirstListItem<T = Rec>(filter: string): Promise<T> {
    const [first] = await this.getFullList<T>({ filter });
    if (!first) throw new Error("Registro no encontrado");
    return first;
  }

  async create<T = Rec>(body: Record<string, unknown> | FormData): Promise<T> {
    await this.ready();
    const now = new Date().toISOString();
    const rec = { ...toPlain(body), id: newId(), created: now, updated: now } as Rec;
    col(this.name).set(rec.id, rec);
    persist(this.name, rec);
    emit(this.name, { action: "create", record: clean(rec) });
    return clean(rec) as T;
  }

  async update<T = Rec>(id: string, body: Record<string, unknown> | FormData): Promise<T> {
    await this.ready();
    const prev = col(this.name).get(id);
    if (!prev) throw new Error("Registro no encontrado");
    const rec = { ...prev, ...toPlain(body), id, updated: new Date().toISOString() } as Rec;
    col(this.name).set(id, rec);
    persist(this.name, rec);
    // Si es el usuario con sesión iniciada, refresca su ficha.
    if (this.name === "users" && this.store.record?.id === id) this.store.save(this.store.token, clean(rec));
    emit(this.name, { action: "update", record: clean(rec) });
    return clean(rec) as T;
  }

  async delete(id: string): Promise<boolean> {
    await this.ready();
    const prev = col(this.name).get(id);
    if (!prev) return false;
    col(this.name).delete(id);
    unpersist(this.name, id);
    emit(this.name, { action: "delete", record: clean(prev) });
    return true;
  }

  async subscribe<T = Rec>(
    _topic: string,
    cb: (e: { action: string; record: T }) => void,
    opts: { filter?: string } = {},
  ): Promise<() => void> {
    const entry = { cb: cb as unknown as (e: SubEvent) => void, clauses: parseFilter(opts.filter) };
    if (!subs.has(this.name)) subs.set(this.name, new Set());
    subs.get(this.name)!.add(entry);
    return () => {
      subs.get(this.name)?.delete(entry);
    };
  }

  async authWithPassword(email: string, password: string) {
    await this.ready();
    const user = [...col("users").values()].find(
      (u) => String(u.email).toLowerCase() === email.trim().toLowerCase(),
    );
    const ok = user && (await hashPassword(password, String(user.salt))) === user.password_hash;
    if (!user || !ok || user.active === false) throw new Error("Correo o contraseña incorrectos");
    this.store.save(`demo.${user.id}`, clean(user));
    return { token: this.store.token, record: this.store.record };
  }

  async authRefresh() {
    await this.ready();
    const id = this.store.token.replace(/^demo\./, "");
    const user = col("users").get(id);
    if (!user || user.active === false) {
      this.store.clear();
      throw new Error("Sesión no válida");
    }
    this.store.save(this.store.token, clean(user));
    return { token: this.store.token, record: this.store.record };
  }
}

export class LocalPB {
  authStore = new LocalAuthStore();
  files = {
    getToken: async () => "",
    getURL: (rec: Record<string, unknown>, filename: string) => {
      const blob = Object.entries(rec).find(([k, v]) => k.startsWith("__blob_") && v instanceof Blob)?.[1] as
        | Blob
        | undefined;
      return blob ? URL.createObjectURL(blob) : `#${filename}`;
    },
  };
  collection(name: string) {
    return new LocalCollection(name, this.authStore);
  }
  autoCancellation() {}
}
