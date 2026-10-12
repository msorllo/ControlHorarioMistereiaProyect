/// <reference path="../pb_data/types.d.ts" />

// Fase 3: estado del ciclo de vida del proyecto (en curso / en pausa / terminado).
// `active` sigue controlando si aparece en el selector de fichaje;
// se deriva del estado (solo "en_curso" queda activo).

migrate(
  (app) => {
    const projects = app.findCollectionByNameOrId("projects");
    projects.fields.add(
      new SelectField({
        name: "status",
        maxSelect: 1,
        values: ["en_curso", "pausado", "terminado"],
      }),
    );
    app.save(projects);

    // Los proyectos existentes activos pasan a "en_curso".
    for (const p of app.findRecordsByFilter("projects", "id != ''", "", 500, 0)) {
      p.set("status", p.get("active") ? "en_curso" : "terminado");
      app.save(p);
    }
  },
  (app) => {
    const projects = app.findCollectionByNameOrId("projects");
    projects.fields.removeByName("status");
    app.save(projects);
  },
);
