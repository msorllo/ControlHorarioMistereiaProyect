/// <reference path="../pb_data/types.d.ts" />

// Fase 3: personalización avanzada de proyectos.
// - icon: emoji identificativo
// - description: notas del proyecto
// - budget_hours: presupuesto de horas (para ver progreso y avisos de exceso)
// - billing_rate: €/h que se FACTURA al cliente (para calcular margen = facturado - coste)
// - deadline: fecha límite (YYYY-MM-DD)

migrate(
  (app) => {
    const projects = app.findCollectionByNameOrId("projects");
    projects.fields.add(new TextField({ name: "icon", max: 8 }));
    projects.fields.add(new TextField({ name: "description", max: 500 }));
    projects.fields.add(new NumberField({ name: "budget_hours", min: 0 }));
    projects.fields.add(new NumberField({ name: "billing_rate", min: 0 }));
    projects.fields.add(new TextField({ name: "deadline", max: 10 }));
    app.save(projects);
  },
  (app) => {
    const projects = app.findCollectionByNameOrId("projects");
    for (const f of ["icon", "description", "budget_hours", "billing_rate", "deadline"]) {
      try {
        projects.fields.removeByName(f);
      } catch (_) {}
    }
    app.save(projects);
  },
);
