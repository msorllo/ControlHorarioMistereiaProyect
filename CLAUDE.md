@AGENTS.md

# Control Horario Mistereia — contexto del proyecto

SaaS de control horario/RRHH multi-negocio (Next.js 16 PWA + PocketBase, NO Supabase). Todo el texto de la UI, comentarios y conversación en **español de España**; código en inglés. Lee `README.md` (visión y comandos) y `PUBLICAR-DEMO.md` (demo pública y auditoría).

## Reglas operativas
- **Dos modos:** app completa (PocketBase + `/api/*` en servidor) y **demo pública estática** (`NEXT_PUBLIC_DEMO=1`, datos en IndexedDB, sin servidor). Cualquier cambio de datos debe funcionar en ambos: las páginas usan `getPB()` (`src/lib/pb.ts`) y `apiFetch()` (`src/lib/api.ts`), nunca `fetch("/api/…")` directo ni el SDK de PocketBase suelto.
- La demo implementa solo lo que la app usa de PocketBase (`src/lib/local-pb/client.ts`): filtros `campo op valor` unidos con `&&`, `sort`, `subscribe`. Si usas un filtro nuevo (`||`, paréntesis, `?=`, expand…), amplíalo ahí.
- Los ajustes de marca pasan por `src/lib/theme.ts` (`applyBrand`): fija `--on-primary` para que el texto sobre el color de marca siempre se lea. Usa `text-on-primary`, no `text-white`, sobre `bg-primary`.
- Guardados de Configuración: en cola y optimistas (`save()` en `settings/page.tsx`) y actualizan el negocio global con `updateBusiness`.
- Errores de PocketBase al usuario: traducidos con `friendlyPbError` (`src/lib/pb-errors.ts`).
- **Nunca** subir `.env*`, `pocketbase/pb_data/`, `pocketbase.exe` (datos reales). `GUIA IA/` es ajena y está ignorada. Los seeds exigen `PB_ADMIN_*` por entorno.
- Calidad: `npx tsc --noEmit` debe pasar antes de compilar la demo.
- Rendimiento de la demo: `pb.demo.ts` sustituye a `pb.ts` al compilar (misma API pública en ambos); `build-demo.mjs` aplana los fragmentos `__next.*` para que la precarga no dé 404; no uses `blur-*`/`backdrop-blur` ni `<a href>` interno (usa `<Link>`). Detalle en `PUBLICAR-DEMO.md`.

## Despliegue
- Repo: https://github.com/msorllo/ControlHorarioMistereiaProyect (rama `main`).
- Demo pública: https://control-horario-mistereia.vercel.app (`npm run deploy:vercel`). Cloudflare Pages: `npm run deploy:cloudflare` tras `npx wrangler login` (pendiente de autorizar por la usuaria).
- Enlazada desde la web de Mistereia: `Desktop/Mistereia/MISTEREIA/WEB - Google` (`/proyectos`, tarjeta `control-horario`), publicada en https://mistereia.com/proyectos (2026-10-12). Para cambiarla: editar en `rediseno-portfolio`, minificar y publicar con `tools/PUBLICAR.bat`.

## Pendiente
- Cloudflare Pages, PWA instalable (Serwist instalado, sin service worker), probar en la demo subida de documentos y alta de empleados.
