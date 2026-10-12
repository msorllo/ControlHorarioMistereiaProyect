// Compila la DEMO PÚBLICA: sitio 100 % estático (carpeta demo-dist/), sin servidor ni base de datos.
// Los datos de cada visitante se guardan en su navegador. Se puede alojar gratis (Cloudflare Pages, etc.).
//
// Uso:  npm run build:demo
//
// Se compila en una copia temporal (.demo-build/) SIN las rutas /api/* (solo servidor, no caben en una
// exportación estática) y sin tocar tu proyecto, tus datos ni el servidor de desarrollo si está abierto.
// Tampoco se copia nada sensible: ni .env*, ni pocketbase/, ni scripts/.
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, rmSync, symlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const work = path.join(root, ".demo-build");

rmSync(work, { recursive: true, force: true });
rmSync(path.join(root, "demo-dist"), { recursive: true, force: true });

const skipApi = (src) => !src.split(path.sep).join("/").endsWith("/src/app/api");
cpSync(path.join(root, "src"), path.join(work, "src"), { recursive: true, filter: skipApi });
cpSync(path.join(root, "public"), path.join(work, "public"), { recursive: true });
for (const f of ["package.json", "package-lock.json", "tsconfig.json", "postcss.config.mjs", "eslint.config.mjs", "next.config.ts"]) {
  cpSync(path.join(root, f), path.join(work, f));
}
symlinkSync(path.join(root, "node_modules"), path.join(work, "node_modules"), "junction");

const r = spawnSync("npx", ["next", "build"], {
  cwd: work,
  stdio: "inherit",
  shell: true,
  env: { ...process.env, NEXT_PUBLIC_DEMO: "1", NEXT_PUBLIC_PB_URL: "", DEMO_TURBOPACK_ROOT: root },
});
const code = r.status ?? 1;

if (code === 0 && existsSync(path.join(work, "demo-dist"))) {
  cpSync(path.join(work, "demo-dist"), path.join(root, "demo-dist"), { recursive: true });
  // Cabeceras de seguridad para Vercel (Cloudflare usa public/_headers, que ya va dentro).
  cpSync(path.join(root, "scripts", "vercel.demo.json"), path.join(root, "demo-dist", "vercel.json"));
  console.log("\n✔ Demo lista en demo-dist/ (sube esa carpeta a un hosting estático).");
}
// Quita el enlace antes de borrar para no tocar node_modules real.
rmSync(path.join(work, "node_modules"), { force: true });
rmSync(work, { recursive: true, force: true });
process.exit(code);
