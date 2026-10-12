# Control Horario Mistereia

SaaS de control horario y RRHH para pequeños negocios, móvil-first. Multi-negocio, con módulos
activables (fichaje, turnos, chat, informes para la gestoría, proyectos, documentos, logros…).

- **Demo pública (gratis, sin registro):** <https://control-horario-mistereia.vercel.app>
- **Repositorio:** <https://github.com/msorllo/ControlHorarioMistereiaProyect>
- Enlazada desde `/proyectos` de la web de Mistereia (proyecto nº 10).

## Dos modos de ejecución

| | App completa (local/privada) | Demo pública |
|---|---|---|
| Datos | PocketBase (SQLite) en tu PC o servidor | IndexedDB en el navegador de cada visitante |
| Servidor | Sí (Next.js + PocketBase) | No: sitio 100 % estático, coste 0 |
| IA | Ollama local / Claude (claves solo en servidor) | Sin IA: el asistente usa reglas |
| Arranque | `INICIAR-CONTROL-HORARIO.bat` o `npm run dev` | `npm run build:demo` |

## Stack

Next.js 16 (App Router) · React 19 · Tailwind v4 · TypeScript · PocketBase v0.39 (esquema en
`pocketbase/pb_migrations`, versionado). Antes de tocar código de Next lee `AGENTS.md`: esta versión tiene
cambios que rompen compatibilidad y su documentación está en `node_modules/next/dist/docs/`.

## Desarrollo

```bash
cp .env.example .env.local   # (crea .env.local con PB_ADMIN_EMAIL / PB_ADMIN_PASS, ver abajo)
npm install
npm run dev                  # http://localhost:3000   (PocketBase en :8090)
```

Variables (`.env.local`, nunca se sube): `NEXT_PUBLIC_PB_URL`, `PB_ADMIN_EMAIL`, `PB_ADMIN_PASS`,
y opcionales `OLLAMA_URL`, `OLLAMA_MODEL`, `ANTHROPIC_API_KEY`. Los `scripts/seed-*.mjs` exigen
`PB_ADMIN_EMAIL`/`PB_ADMIN_PASS` por entorno (sin valores por defecto).

## Demo pública

```bash
npm run build:demo        # genera demo-dist/ (estático) en una copia sin /api ni secretos
npm run deploy:vercel     # publica en Vercel
npm run deploy:cloudflare # publica en Cloudflare Pages (requiere `npx wrangler login` una vez)
```

Detalles, auditoría de seguridad y limitaciones: [`PUBLICAR-DEMO.md`](PUBLICAR-DEMO.md).

## Arquitectura de la demo

`src/lib/local-pb/` es un cliente "PocketBase local" (misma API que usa la app: `collection().getFullList/
create/update/delete/subscribe`, `authStore`, `files`) sobre IndexedDB, con datos de ejemplo ficticios
(`seed.ts`) y el equivalente en el navegador de las rutas `/api/*` (`api.ts`). Se activa con
`NEXT_PUBLIC_DEMO=1`. Todo `fetch` a `/api/*` pasa por `src/lib/api.ts` (`apiFetch`).

## PWA instalable

Pendiente: los paquetes Serwist están instalados pero no cableados (sin service worker). Ver notas en
`PUBLICAR-DEMO.md`.
