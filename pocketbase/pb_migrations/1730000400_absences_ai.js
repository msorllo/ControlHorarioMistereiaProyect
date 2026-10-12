/// <reference path="../pb_data/types.d.ts" />

// Fase 2: ausencias (propuestas por el asistente IA o a mano) + config de IA por negocio.
//
// Flujo de ausencias: el empleado la solicita (status=pending) → manager/owner
// la aprueba o rechaza. El asistente IA solo PROPONE; siempre confirma un humano.

migrate(
  (app) => {
    const businesses = app.findCollectionByNameOrId("businesses");
    const users = app.findCollectionByNameOrId("users");

    // Config de IA por negocio: { provider: "ollama"|"anthropic"|"none", model?: string }
    businesses.fields.add(new JSONField({ name: "ai", maxSize: 100000 }));
    app.save(businesses);

    const absences = new Collection({
      type: "base",
      name: "absences",
      // Ver: las propias, o todas las del negocio si eres manager/owner.
      listRule:
        '@request.auth.id != "" && business = @request.auth.business && (user = @request.auth.id || @request.auth.role = "owner" || @request.auth.role = "manager")',
      viewRule:
        '@request.auth.id != "" && business = @request.auth.business && (user = @request.auth.id || @request.auth.role = "owner" || @request.auth.role = "manager")',
      // Crear: solo tu propia solicitud, en tu negocio, y siempre pendiente.
      createRule:
        '@request.auth.id != "" && business = @request.auth.business && user = @request.auth.id && status = "pending"',
      // Aprobar/rechazar: manager u owner del negocio.
      updateRule:
        '@request.auth.id != "" && business = @request.auth.business && (@request.auth.role = "owner" || @request.auth.role = "manager")',
      deleteRule: null,
      fields: [
        { type: "relation", name: "business", required: true, maxSelect: 1, collectionId: businesses.id, cascadeDelete: true },
        { type: "relation", name: "user", required: true, maxSelect: 1, collectionId: users.id, cascadeDelete: true },
        { type: "select", name: "type", required: true, maxSelect: 1, values: ["sick", "vacation", "personal", "other"] },
        { type: "date", name: "start_date", required: true },
        { type: "date", name: "end_date", required: true },
        { type: "text", name: "note", max: 500 },
        { type: "select", name: "status", required: true, maxSelect: 1, values: ["pending", "approved", "rejected"] },
        { type: "relation", name: "resolved_by", required: false, maxSelect: 1, collectionId: users.id, cascadeDelete: false },
        { type: "bool", name: "suggested_by_ai" },
        { type: "autodate", name: "created", onCreate: true },
        { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
      ],
      indexes: ["CREATE INDEX idx_abs_business_status ON absences (business, status)"],
    });
    app.save(absences);
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId("absences"));
    } catch (_) {}
    try {
      const businesses = app.findCollectionByNameOrId("businesses");
      businesses.fields.removeByName("ai");
      app.save(businesses);
    } catch (_) {}
  },
);
