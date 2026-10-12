/// <reference path="../pb_data/types.d.ts" />

// Fase 3: tablón de anuncios. Comunicados del negocio a todo el equipo.

migrate(
  (app) => {
    const businesses = app.findCollectionByNameOrId("businesses");
    const users = app.findCollectionByNameOrId("users");

    const announcements = new Collection({
      type: "base",
      name: "announcements",
      // Todos los del negocio leen el tablón.
      listRule: '@request.auth.id != "" && business = @request.auth.business',
      viewRule: '@request.auth.id != "" && business = @request.auth.business',
      // Publicar/editar/borrar: manager u owner.
      createRule: '@request.auth.id != "" && business = @request.auth.business && (@request.auth.role = "owner" || @request.auth.role = "manager")',
      updateRule: '@request.auth.id != "" && business = @request.auth.business && (@request.auth.role = "owner" || @request.auth.role = "manager")',
      deleteRule: '@request.auth.id != "" && business = @request.auth.business && (@request.auth.role = "owner" || @request.auth.role = "manager")',
      fields: [
        { type: "relation", name: "business", required: true, maxSelect: 1, collectionId: businesses.id, cascadeDelete: true },
        { type: "relation", name: "author", required: false, maxSelect: 1, collectionId: users.id, cascadeDelete: false },
        { type: "text", name: "title", required: true, max: 140 },
        { type: "text", name: "body", required: true, max: 4000 },
        { type: "bool", name: "pinned" },
        { type: "autodate", name: "created", onCreate: true },
        { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
      ],
      indexes: ["CREATE INDEX idx_ann_business ON announcements (business, created)"],
    });
    app.save(announcements);
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId("announcements"));
    } catch (_) {}
  },
);
