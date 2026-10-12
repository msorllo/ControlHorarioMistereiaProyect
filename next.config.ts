import type { NextConfig } from "next";
import path from "node:path";

// Demo pública: exportación estática (sin servidor, coste 0). Ver scripts/build-demo.mjs.
const isDemo = process.env.NEXT_PUBLIC_DEMO === "1";

const nextConfig: NextConfig = {
  // Fija la raíz del proyecto para Turbopack (evita que Next detecte por error
  // un package-lock.json suelto en la carpeta de usuario como raíz del workspace).
  turbopack: {
    root: process.env.DEMO_TURBOPACK_ROOT ?? path.resolve(),
  },
  ...(isDemo ? { output: "export" as const, distDir: "demo-dist" } : {}),
};

export default nextConfig;
