import type PocketBase from "pocketbase";
import { LocalPB } from "@/lib/local-pb/client";
import { initStore } from "@/lib/local-pb/store";
import { seedDemo } from "@/lib/local-pb/seed";

/**
 * Variante de `pb.ts` para la DEMO pública. `scripts/build-demo.mjs` la copia sobre `pb.ts`
 * al compilar, de modo que el SDK de PocketBase (≈50 KB) no entra en el bundle: la demo
 * solo usa el cliente local (IndexedDB). Mantén la misma API pública que `pb.ts`.
 */
export const PB_URL = "";

let client: PocketBase | null = null;

export function getPB(): PocketBase {
  if (!client) {
    client = new LocalPB() as unknown as PocketBase;
    // Abre (y siembra) la base local mientras el visitante lee la pantalla, para que entrar sea inmediato.
    if (typeof window !== "undefined") {
      const warm = () => void initStore(seedDemo);
      if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(warm, { timeout: 1500 });
      else window.setTimeout(warm, 200);
    }
  }
  return client;
}
