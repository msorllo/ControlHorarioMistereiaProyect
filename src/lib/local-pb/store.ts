/**
 * Almacén local del modo demo: todo en memoria + persistencia en IndexedDB.
 * Los datos nunca salen del navegador del visitante.
 */
export type Rec = Record<string, unknown> & { id: string; created: string; updated: string };

const DB_NAME = "mistereia-control-horario-demo";
const STORE = "records";
const VERSION = 1;

let data = new Map<string, Map<string, Rec>>();
let db: IDBDatabase | null = null;
let ready: Promise<void> | null = null;

function openDB(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "k" });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null); // navegación privada o IndexedDB bloqueado: funciona solo en memoria
    }
  });
}

export function initStore(seed: () => Promise<void>): Promise<void> {
  if (ready) return ready;
  ready = (async () => {
    db = await openDB();
    if (db) {
      const rows = await new Promise<{ k: string; c: string; rec: Rec }[]>((resolve) => {
        const r = db!.transaction(STORE).objectStore(STORE).getAll();
        r.onsuccess = () => resolve(r.result as { k: string; c: string; rec: Rec }[]);
        r.onerror = () => resolve([]);
      });
      for (const row of rows) col(row.c).set(row.rec.id, row.rec);
    }
    if (col("users").size === 0) await seed();
  })();
  return ready;
}

export function col(name: string): Map<string, Rec> {
  let m = data.get(name);
  if (!m) data.set(name, (m = new Map()));
  return m;
}

export function persist(c: string, rec: Rec) {
  if (!db) return;
  try {
    db.transaction(STORE, "readwrite").objectStore(STORE).put({ k: `${c}:${rec.id}`, c, rec });
  } catch {
    /* cuota o error: se mantiene en memoria */
  }
}

export function unpersist(c: string, id: string) {
  if (!db) return;
  try {
    db.transaction(STORE, "readwrite").objectStore(STORE).delete(`${c}:${id}`);
  } catch {
    /* nada */
  }
}

/** Borra TODOS los datos del visitante (botón «Restablecer demo»). */
export async function wipeAll() {
  data = new Map();
  if (db) {
    await new Promise<void>((resolve) => {
      const tx = db!.transaction(STORE, "readwrite");
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  }
  ready = null;
}
