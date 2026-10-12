// Compila la DEMO PÚBLICA: sitio 100 % estático (carpeta demo-dist/), sin servidor ni base de datos.
// Los datos de cada visitante se guardan en su navegador. Se puede alojar gratis (Cloudflare Pages, etc.).
//
// Uso:  npm run build:demo
//
// Se compila en una copia temporal (.demo-build/) SIN las rutas /api/* (solo servidor, no caben en una
// exportación estática) y sin tocar tu proyecto, tus datos ni el servidor de desarrollo si está abierto.
// Tampoco se copia nada sensible: ni .env*, ni pocketbase/, ni scripts/.
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, readdirSync, rmSync, symlinkSync } from "node:fs";
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
// La demo no necesita el SDK de PocketBase: se sustituye pb.ts por su variante local (bundle más ligero).
cpSync(path.join(work, "src", "lib", "pb.demo.ts"), path.join(work, "src", "lib", "pb.ts"));
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
  // Precarga de secciones: Next exporta los fragmentos en carpetas (`__next.app/projects/__PAGE__.txt`)
  // pero el navegador los pide con puntos (`__next.app.projects.__PAGE__.txt`) y recibía 404, así que
  // cada sección se descargaba al pulsarla. Se generan también con el nombre que pide el navegador.
  let flattened = 0;
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      const full = path.join(dir, e.name);
      if (e.name.startsWith("__next.")) {
        const flat = (sub, prefix) => {
          for (const f of readdirSync(sub, { withFileTypes: true })) {
            const name = `${prefix}.${f.name}`;
            if (f.isDirectory()) flat(path.join(sub, f.name), name);
            else {
              cpSync(path.join(sub, f.name), path.join(dir, name));
              flattened++;
            }
          }
        };
        flat(full, e.name);
      } else if (e.name !== "_next") walk(full);
    }
  };
  walk(path.join(root, "demo-dist"));
  console.log(`  ${flattened} fragmentos de precarga generados.`);
  // Cabeceras de seguridad para Vercel (Cloudflare usa public/_headers, que ya va dentro).
  cpSync(path.join(root, "scripts", "vercel.demo.json"), path.join(root, "demo-dist", "vercel.json"));
  // Enlace al proyecto de Vercel (solo identificadores, no son secretos) para que `vercel deploy` publique en el mismo sitio.
  cpSync(path.join(root, "scripts", "vercel.project.json"), path.join(root, "demo-dist", ".vercel", "project.json"));
  console.log("\n✔ Demo lista en demo-dist/ (sube esa carpeta a un hosting estático).");
}
// Quita el enlace antes de borrar para no tocar node_modules real.
rmSync(path.join(work, "node_modules"), { force: true });
rmSync(work, { recursive: true, force: true });
process.exit(code);
