/**
 * Utilidades de geolocalización para el fichaje por ubicación (geofencing).
 */

export interface WorkLocation {
  name: string;
  lat: number;
  lng: number;
  radius_m: number;
}

export interface Coords {
  lat: number;
  lng: number;
  accuracy?: number;
}

/** Distancia en metros entre dos coordenadas (fórmula de Haversine). */
export function distanceMeters(a: Coords, b: Coords): number {
  const R = 6371000; // radio de la Tierra en metros
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export interface GeoCheck {
  inside: boolean;
  /** Zona más cercana (o la que contiene al empleado). */
  nearest?: WorkLocation;
  /** Distancia en metros a la zona más cercana. */
  distance?: number;
}

/**
 * Comprueba si unas coordenadas están dentro de alguna zona de trabajo.
 * Si no hay zonas definidas, se considera "dentro" (geofencing no obligatorio).
 */
export function checkWithinLocations(coords: Coords, locations: WorkLocation[] | undefined): GeoCheck {
  if (!locations || locations.length === 0) return { inside: true };
  let best: GeoCheck = { inside: false };
  for (const loc of locations) {
    const d = distanceMeters(coords, loc);
    if (best.distance === undefined || d < best.distance) {
      best = { inside: d <= loc.radius_m, nearest: loc, distance: d };
    }
    if (d <= loc.radius_m) return { inside: true, nearest: loc, distance: d };
  }
  return best;
}

/** Pide la ubicación actual del navegador (promesa). */
export function getCurrentCoords(): Promise<Coords> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Tu dispositivo no permite geolocalización."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      (err) => {
        const msg =
          err.code === err.PERMISSION_DENIED
            ? "Has bloqueado el acceso a tu ubicación. Actívalo para fichar por geolocalización."
            : "No se ha podido obtener tu ubicación. Inténtalo de nuevo.";
        reject(new Error(msg));
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 10000 },
    );
  });
}

export function fmtDistance(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}
