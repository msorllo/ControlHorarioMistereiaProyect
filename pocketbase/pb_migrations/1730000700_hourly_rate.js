/// <reference path="../pb_data/types.d.ts" />

// Fase 3: tarifa por hora del empleado (€/h) para calcular costes en los informes.

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    users.fields.add(new NumberField({ name: "hourly_rate", min: 0 }));
    app.save(users);
  },
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    users.fields.removeByName("hourly_rate");
    app.save(users);
  },
);
