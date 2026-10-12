import { IS_DEMO } from "@/lib/demo";
import { getPB } from "@/lib/pb";
import { localApi } from "@/lib/local-pb/api";
import type { LocalPB } from "@/lib/local-pb/client";

/**
 * `fetch` para las rutas `/api/*` de la app. En producción con servidor llama a
 * la ruta real; en la demo pública (sin servidor) la resuelve en el navegador.
 */
export function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const pb = getPB();
  if (IS_DEMO) return localApi(pb as unknown as LocalPB, path, init);
  const headers = new Headers(init.headers);
  if (pb.authStore.token && !headers.has("Authorization")) headers.set("Authorization", pb.authStore.token);
  return fetch(path, { ...init, headers });
}
