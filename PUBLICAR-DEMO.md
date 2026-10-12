# Demo pública de Control Horario Mistereia

Versión **100 % estática** (sin servidor ni base de datos tuya). Cada visitante tiene su propio
negocio de ejemplo, que se guarda **solo en su navegador** (IndexedDB). Coste de hosting: 0 €.

## Cómo compilarla

```bash
npm run build:demo
```

Genera `demo-dist/` (≈2 MB). Se compila en una copia temporal sin `/api`, `.env*`, `pocketbase/` ni
`scripts/`, así que **nada sensible puede acabar dentro**. La app normal (`npm run dev` + PocketBase)
no cambia.

## Dónde está publicada

- Vercel (producción): <https://control-horario-mistereia.vercel.app> — `npm run deploy:vercel` (usa `scripts/vercel.demo.json` para las cabeceras).
- Repositorio: <https://github.com/msorllo/ControlHorarioMistereiaProyect>.
- Escaneo del sitio publicado (2026-10-12): sin claves, contraseñas de administrador ni datos personales.

## Cómo publicarla gratis (Cloudflare Pages, sin límite de ancho de banda)

Atajo: `npx wrangler login` (una vez, abre el navegador para autorizar) y `npm run deploy:cloudflare`.

1. Cloudflare → Workers & Pages → Create → Pages → *Direct upload*.
2. Sube la carpeta `demo-dist/`. (`_headers` ya incluye CSP y cabeceras de seguridad.)
3. Enlaza la URL resultante desde la sección de proyectos de la web de Mistereia.

Alternativa por consola: `npx wrangler pages deploy demo-dist --project-name control-horario-demo`.

## Auditoría de seguridad (2026-10-12)

| Punto | Estado |
|---|---|
| Secretos en el bundle (`PB_ADMIN_*`, `ANTHROPIC_API_KEY`, contraseñas admin) | Escaneado `demo-dist/`: **ninguno** |
| Datos personales reales (correo personal, coordenadas de casa, negocios reales de `pb_data`) | **No salen**: `pb_data/` no se compila; la demo usa datos 100 % ficticios generados en el navegador |
| Aislamiento entre visitantes | Total: no hay servidor compartido; cada navegador tiene su propia BD |
| Contraseñas | Hash SHA-256 con sal por usuario, solo en el navegador del propio visitante |
| Coste para ti | 0: sin IA de pago (el asistente usa reglas), sin servidor, fuentes autoalojadas, sin analítica |
| Abuso / spam de registros | Imposible de forma compartida: los registros solo afectan al navegador de quien los crea |
| Cabeceras | CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` |
| Accesos de prueba en login | Solo se muestran en la demo o en desarrollo; **nunca** en un servidor de producción real |
| Credenciales por defecto en `scripts/seed-*.mjs` | **Eliminadas**: ahora exigen `PB_ADMIN_EMAIL` / `PB_ADMIN_PASS` por entorno |

### Pendiente / a vigilar
- **No** subir nunca `pocketbase/pb_data/`, `.env.local` ni `pocketbase.exe` a ningún repositorio o hosting.
  El `.gitignore` ya los excluye. Este proyecto ya tiene su propio repositorio git (antes colgaba del repo accidental de la carpeta de usuario); comprueba `git rev-parse --show-toplevel` antes de commitear.
- La contraseña de admin local de PocketBase (`.env.local`) quedó escrita en notas antiguas de este proyecto:
  cámbiala si algún día expones PocketBase fuera de tu PC.
- Limitaciones de la demo (por diseño): sin chat entre usuarios reales, sin sincronizar entre dispositivos,
  sin IA real, el panel de SuperAdmin no existe. Si el visitante borra los datos del navegador, la demo se reinicia.
- Ofrecer una versión con cuentas reales y multi-dispositivo exigiría un backend alojado 24/7 (no es coste 0).

## PWA instalable (pendiente)

Una PWA es una web que el visitante puede "instalar" como app (icono en el escritorio o el móvil, ventana propia
y funcionamiento sin conexión). Ya existen `public/manifest.webmanifest` e `icon.svg`, y los paquetes `serwist`
y `@serwist/next` están instalados, pero falta el service worker (`sw.ts`), registrarlo y declarar iconos PNG de
192 y 512 px en el manifest. Hasta entonces el navegador no ofrece "Instalar". En la demo estática encaja bien.
