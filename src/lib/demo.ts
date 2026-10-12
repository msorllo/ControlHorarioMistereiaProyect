/**
 * Modo DEMO público: sin servidor ni base de datos propia.
 * Los datos de cada visitante viven SOLO en su navegador (IndexedDB), así que
 * no cuestan nada de hosting y nadie puede ver los datos de otro visitante.
 * Se activa al compilar con NEXT_PUBLIC_DEMO=1 (ver scripts/build-demo.mjs).
 */
export const IS_DEMO = process.env.NEXT_PUBLIC_DEMO === "1";
