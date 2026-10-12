/// <reference path="../pb_data/types.d.ts" />

// Fase 3: documentos (nóminas, contratos, certificados) con control de caducidad.
// El archivo es "protected": requiere token de acceso, respeta las reglas de visibilidad.

migrate(
  (app) => {
    const businesses = app.findCollectionByNameOrId("businesses");
    const users = app.findCollectionByNameOrId("users");

    const documents = new Collection({
      type: "base",
      name: "documents",
      // Ver: el empleado ve los SUYOS y los generales (user vacío); manager/owner ven todos.
      listRule: '@request.auth.id != "" && business = @request.auth.business && (user = @request.auth.id || user = "" || @request.auth.role = "owner" || @request.auth.role = "manager")',
      viewRule: '@request.auth.id != "" && business = @request.auth.business && (user = @request.auth.id || user = "" || @request.auth.role = "owner" || @request.auth.role = "manager")',
      // Subir/editar/borrar: manager u owner.
      createRule: '@request.auth.id != "" && business = @request.auth.business && (@request.auth.role = "owner" || @request.auth.role = "manager")',
      updateRule: '@request.auth.id != "" && business = @request.auth.business && (@request.auth.role = "owner" || @request.auth.role = "manager")',
      deleteRule: '@request.auth.id != "" && business = @request.auth.business && (@request.auth.role = "owner" || @request.auth.role = "manager")',
      fields: [
        { type: "relation", name: "business", required: true, maxSelect: 1, collectionId: businesses.id, cascadeDelete: true },
        { type: "relation", name: "user", required: false, maxSelect: 1, collectionId: users.id, cascadeDelete: true },
        { type: "text", name: "title", required: true, max: 160 },
        { type: "select", name: "doc_type", required: true, maxSelect: 1, values: ["nomina", "contrato", "certificado", "otro"] },
        { type: "file", name: "file", required: true, maxSelect: 1, maxSize: 10485760, protected: true, mimeTypes: ["application/pdf", "image/png", "image/jpeg"] },
        { type: "text", name: "expires", max: 10 },
        { type: "relation", name: "uploaded_by", required: false, maxSelect: 1, collectionId: users.id, cascadeDelete: false },
        { type: "autodate", name: "created", onCreate: true },
      ],
      indexes: ["CREATE INDEX idx_docs_business_user ON documents (business, user)"],
    });
    app.save(documents);
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId("documents"));
    } catch (_) {}
  },
);
