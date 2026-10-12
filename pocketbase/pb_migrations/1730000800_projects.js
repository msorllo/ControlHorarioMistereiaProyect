/// <reference path="../pb_data/types.d.ts" />

// Fase 3: horas por proyecto/cliente. Cada fichaje puede imputarse a un proyecto,
// para sacar informes de horas y coste por proyecto (rentabilidad).

migrate(
  (app) => {
    const businesses = app.findCollectionByNameOrId("businesses");
    const users = app.findCollectionByNameOrId("users");

    const projects = new Collection({
      type: "base",
      name: "projects",
      // Todos los del negocio pueden VER los proyectos (para poder elegirlos al fichar).
      listRule: '@request.auth.id != "" && business = @request.auth.business',
      viewRule: '@request.auth.id != "" && business = @request.auth.business',
      // Crear/editar/borrar proyectos: manager u owner.
      createRule: '@request.auth.id != "" && business = @request.auth.business && (@request.auth.role = "owner" || @request.auth.role = "manager")',
      updateRule: '@request.auth.id != "" && business = @request.auth.business && (@request.auth.role = "owner" || @request.auth.role = "manager")',
      deleteRule: '@request.auth.id != "" && business = @request.auth.business && (@request.auth.role = "owner" || @request.auth.role = "manager")',
      fields: [
        { type: "relation", name: "business", required: true, maxSelect: 1, collectionId: businesses.id, cascadeDelete: true },
        { type: "text", name: "name", required: true, max: 120 },
        { type: "text", name: "client", max: 120 },
        { type: "text", name: "color", max: 9 },
        { type: "bool", name: "active" },
        { type: "relation", name: "created_by", required: false, maxSelect: 1, collectionId: users.id, cascadeDelete: false },
        { type: "autodate", name: "created", onCreate: true },
        { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
      ],
      indexes: ["CREATE INDEX idx_projects_business ON projects (business, active)"],
    });
    app.save(projects);

    // Añadir relación opcional `project` a los fichajes.
    const timeEntries = app.findCollectionByNameOrId("time_entries");
    timeEntries.fields.add(
      new RelationField({
        name: "project",
        required: false,
        maxSelect: 1,
        collectionId: projects.id,
        cascadeDelete: false,
      }),
    );
    app.save(timeEntries);
  },
  (app) => {
    try {
      const timeEntries = app.findCollectionByNameOrId("time_entries");
      timeEntries.fields.removeByName("project");
      app.save(timeEntries);
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId("projects"));
    } catch (_) {}
  },
);
