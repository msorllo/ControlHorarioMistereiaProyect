/// <reference path="../pb_data/types.d.ts" />

// Fase 3: gamificación. Reconocimientos (kudos) entre compañeros del mismo negocio.

migrate(
  (app) => {
    const businesses = app.findCollectionByNameOrId("businesses");
    const users = app.findCollectionByNameOrId("users");

    const kudos = new Collection({
      type: "base",
      name: "kudos",
      // Todos los del negocio ven el muro de reconocimientos.
      listRule: '@request.auth.id != "" && business = @request.auth.business',
      viewRule: '@request.auth.id != "" && business = @request.auth.business',
      // Crear: solo en tu negocio, en tu nombre y no puedes darte kudos a ti mismo.
      createRule:
        '@request.auth.id != "" && business = @request.auth.business && from_user = @request.auth.id && to_user != @request.auth.id',
      updateRule: null,
      // Puedes borrar los que tú diste (rectificar).
      deleteRule: '@request.auth.id != "" && from_user = @request.auth.id',
      fields: [
        { type: "relation", name: "business", required: true, maxSelect: 1, collectionId: businesses.id, cascadeDelete: true },
        { type: "relation", name: "from_user", required: true, maxSelect: 1, collectionId: users.id, cascadeDelete: true },
        { type: "relation", name: "to_user", required: true, maxSelect: 1, collectionId: users.id, cascadeDelete: true },
        { type: "text", name: "emoji", max: 8 },
        { type: "text", name: "message", max: 300 },
        { type: "autodate", name: "created", onCreate: true },
      ],
      indexes: ["CREATE INDEX idx_kudos_business ON kudos (business, created)"],
    });
    app.save(kudos);
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId("kudos"));
    } catch (_) {}
  },
);
