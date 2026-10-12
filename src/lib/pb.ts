import PocketBase from "pocketbase";
import { IS_DEMO } from "@/lib/demo";
import { LocalPB } from "@/lib/local-pb/client";

/**
 * URL del backend PocketBase.
 * En desarrollo apunta al binario local (un archivo de datos privado por negocio).
 * En producción se define con la variable de entorno NEXT_PUBLIC_PB_URL.
 */
export const PB_URL = process.env.NEXT_PUBLIC_PB_URL ?? "http://127.0.0.1:8090";

let browserClient: PocketBase | null = null;

/**
 * Devuelve el cliente de PocketBase.
 * - En el navegador: un único cliente compartido (mantiene la sesión del usuario).
 * - En el servidor: una instancia nueva y aislada por render, para no mezclar
 *   las sesiones de distintos usuarios entre peticiones.
 */
export function getPB(): PocketBase {
  if (typeof window === "undefined") {
    return new PocketBase(PB_URL);
  }
  if (!browserClient) {
    // Demo pública: cliente local (IndexedDB) con la misma API que PocketBase.
    if (IS_DEMO) {
      browserClient = new LocalPB() as unknown as PocketBase;
      return browserClient;
    }
    browserClient = new PocketBase(PB_URL);
    // Evita que peticiones solapadas se cancelen entre sí (útil en React).
    browserClient.autoCancellation(false);
  }
  return browserClient;
}
