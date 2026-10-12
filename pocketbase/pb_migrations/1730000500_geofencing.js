/// <reference path="../pb_data/types.d.ts" />

// Fase 2: geofencing. Cada negocio define sus zonas de trabajo:
// businesses.locations = [{ name, lat, lng, radius_m }, ...]
// El fichaje comprueba si el empleado está dentro y registra método "geo" + coordenadas.

migrate(
  (app) => {
    const businesses = app.findCollectionByNameOrId("businesses");
    businesses.fields.add(new JSONField({ name: "locations", maxSize: 200000 }));
    app.save(businesses);
  },
  (app) => {
    const businesses = app.findCollectionByNameOrId("businesses");
    businesses.fields.removeByName("locations");
    app.save(businesses);
  },
);
