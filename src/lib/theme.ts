/** Utilidades de marca blanca: aplican los colores del negocio y garantizan que el texto sea legible. */

function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance([r, g, b]: [number, number, number]): number {
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

const toHex = (rgb: number[]) => "#" + rgb.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("");

/** Color de texto (oscuro o claro) con buen contraste sobre el color indicado. */
export function onColor(hex: string): string {
  const rgb = hexToRgb(hex);
  return rgb && luminance(rgb) > 0.4 ? "#12121a" : "#ffffff";
}

const VARS = ["--brand-primary", "--brand-primary-strong", "--brand-accent", "--on-primary", "--on-accent"];

/** Aplica la marca del negocio a toda la interfaz (botones, interruptores, texto sobre color…). */
export function applyBrand(primary?: string, accent?: string) {
  const root = document.documentElement;
  const p = primary && hexToRgb(primary) ? primary : null;
  const a = accent && hexToRgb(accent) ? accent : null;
  if (p) {
    const rgb = hexToRgb(p)!;
    root.style.setProperty("--brand-primary", p);
    root.style.setProperty("--brand-primary-strong", toHex(rgb.map((c) => c * 0.85)));
    root.style.setProperty("--on-primary", onColor(p));
  }
  if (a) {
    root.style.setProperty("--brand-accent", a);
    root.style.setProperty("--on-accent", onColor(a));
  }
}

export function clearBrand() {
  VARS.forEach((v) => document.documentElement.style.removeProperty(v));
}
