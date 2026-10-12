"use client";

import { IS_DEMO } from "@/lib/demo";
import { wipeAll } from "@/lib/local-pb/store";

/**
 * Aviso de la demo pública: los datos viven solo en el navegador del visitante.
 * Permite restablecer la demo (borra todo lo local y vuelve a sembrar datos ficticios).
 */
export default function DemoBanner() {
  if (!IS_DEMO) return null;

  async function reset() {
    if (!window.confirm("Se borrarán todos tus datos de la demo y volverá al estado inicial. ¿Continuar?")) return;
    await wipeAll();
    try {
      localStorage.removeItem("mistereia_demo_auth");
    } catch {
      /* nada */
    }
    window.location.href = "/login";
  }

  return (
    <div className="border-b border-border bg-primary/10 px-4 py-2 text-center text-xs text-ink">
      <span className="font-semibold">Modo demo</span> · Tus datos se guardan solo en este navegador y nadie más puede verlos.{" "}
      <button onClick={reset} className="font-medium text-primary underline-offset-2 hover:underline">
        Restablecer demo
      </button>
    </div>
  );
}
