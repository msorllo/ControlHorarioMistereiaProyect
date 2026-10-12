/// <reference path="../pb_data/types.d.ts" />

// Fase 2: cuadrantes de turnos. Un turno asigna a un empleado un día y una franja.
// El día se guarda como texto "YYYY-MM-DD" (sin líos de zona horaria en el planificador).

migrate(
  (app) => {
    const businesses = app.findCollectionByNameOrId("businesses");
    const users = app.findCollectionByNameOrId("users");

    const shifts = new Collection({
      type: "base",
      name: "shifts",
      // Ver: los propios, o todos los del negocio si eres manager/owner.
      listRule:
        '@request.auth.id != "" && business = @request.auth.business && (user = @request.auth.id || @request.auth.role = "owner" || @request.auth.role = "manager")',
      viewRule:
        '@request.auth.id != "" && business = @request.auth.business && (user = @request.auth.id || @request.auth.role = "owner" || @request.auth.role = "manager")',
      // Crear/editar/borrar turnos: solo manager u owner del negocio.
      createRule:
        '@request.auth.id != "" && business = @request.auth.business && (@request.auth.role = "owner" || @request.auth.role = "manager")',
      updateRule:
        '@request.auth.id != "" && business = @request.auth.business && (@request.auth.role = "owner" || @request.auth.role = "manager")',
      deleteRule:
        '@request.auth.id != "" && business = @request.auth.business && (@request.auth.role = "owner" || @request.auth.role = "manager")',
      fields: [
        { type: "relation", name: "business", required: true, maxSelect: 1, collectionId: businesses.id, cascadeDelete: true },
        { type: "relation", name: "user", required: true, maxSelect: 1, collectionId: users.id, cascadeDelete: true },
        { type: "text", name: "date", required: true, max: 10 },
        { type: "text", name: "start_time", required: true, max: 5 },
        { type: "text", name: "end_time", required: true, max: 5 },
        { type: "text", name: "note", max: 200 },
        { type: "relation", name: "created_by", required: false, maxSelect: 1, collectionId: users.id, cascadeDelete: false },
        { type: "autodate", name: "created", onCreate: true },
        { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
      ],
      indexes: ["CREATE INDEX idx_shifts_business_date ON shifts (business, date)"],
    });
    app.save(shifts);
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId("shifts"));
    } catch (_) {}
  },
);
