/// <reference path="../pb_data/types.d.ts" />

// Migración inicial: esquema base de "Control Horario Mistereia".
//
// Diseño híbrido multi-negocio: cada registro lleva el campo `business`, de modo
// que los datos de un negocio quedan aislados por reglas de seguridad y pueden
// exportarse (o migrarse a su propio archivo) sin arrastrar a otros negocios.

migrate(
  (app) => {
    // ---------------------------------------------------------------- businesses
    const businesses = new Collection({
      type: "base",
      name: "businesses",
      // Un usuario solo ve/gestiona su propio negocio. Crear/borrar: SuperAdmin.
      listRule: '@request.auth.id != "" && id = @request.auth.business',
      viewRule: '@request.auth.id != "" && id = @request.auth.business',
      createRule: null,
      updateRule:
        '@request.auth.id != "" && id = @request.auth.business && @request.auth.role = "owner"',
      deleteRule: null,
      fields: [
        { type: "text", name: "name", required: true, max: 200 },
        { type: "text", name: "slug", required: true, max: 100 },
        { type: "json", name: "theme", maxSize: 200000 },
        { type: "json", name: "modules", maxSize: 200000 },
        { type: "text", name: "timezone", max: 64 },
        { type: "bool", name: "active" },
        { type: "autodate", name: "created", onCreate: true },
        { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
      ],
      indexes: ["CREATE UNIQUE INDEX idx_businesses_slug ON businesses (slug)"],
    });
    app.save(businesses);

    // ------------------------------------------ users (auth por defecto): +campos
    const users = app.findCollectionByNameOrId("users");
    users.fields.add(
      new SelectField({
        name: "role",
        required: true,
        maxSelect: 1,
        values: ["superadmin", "owner", "manager", "employee"],
      }),
    );
    users.fields.add(
      new RelationField({
        name: "business",
        required: false,
        maxSelect: 1,
        collectionId: businesses.id,
        cascadeDelete: false,
      }),
    );
    users.fields.add(new BoolField({ name: "active" }));
    users.fields.add(new TextField({ name: "job_title", max: 120 }));
    app.save(users);

    // --------------------------------------------------------------- time_entries
    const timeEntries = new Collection({
      type: "base",
      name: "time_entries",
      listRule: '@request.auth.id != "" && business = @request.auth.business',
      viewRule: '@request.auth.id != "" && business = @request.auth.business',
      createRule:
        '@request.auth.id != "" && business = @request.auth.business && user = @request.auth.id',
      updateRule: null, // inmutable: es un registro horario legal
      deleteRule: null,
      fields: [
        { type: "relation", name: "business", required: true, maxSelect: 1, collectionId: businesses.id, cascadeDelete: true },
        { type: "relation", name: "user", required: true, maxSelect: 1, collectionId: users.id, cascadeDelete: true },
        { type: "select", name: "type", required: true, maxSelect: 1, values: ["in", "out", "break_start", "break_end"] },
        { type: "select", name: "method", required: true, maxSelect: 1, values: ["manual", "geo", "qr", "nfc", "voice"] },
        { type: "date", name: "at", required: true },
        { type: "number", name: "lat" },
        { type: "number", name: "lng" },
        { type: "text", name: "note", max: 500 },
        { type: "autodate", name: "created", onCreate: true },
      ],
      indexes: ["CREATE INDEX idx_te_business_user_at ON time_entries (business, user, at)"],
    });
    app.save(timeEntries);

    // -------------------------------------------------------------- conversations
    const conversations = new Collection({
      type: "base",
      name: "conversations",
      listRule: '@request.auth.id != "" && members.id ?= @request.auth.id',
      viewRule: '@request.auth.id != "" && members.id ?= @request.auth.id',
      createRule: '@request.auth.id != "" && business = @request.auth.business',
      updateRule: '@request.auth.id != "" && members.id ?= @request.auth.id',
      deleteRule: null,
      fields: [
        { type: "relation", name: "business", required: true, maxSelect: 1, collectionId: businesses.id, cascadeDelete: true },
        { type: "select", name: "type", required: true, maxSelect: 1, values: ["dm", "group", "channel"] },
        { type: "text", name: "name", max: 120 },
        { type: "relation", name: "members", required: true, maxSelect: 0, collectionId: users.id, cascadeDelete: false },
        { type: "autodate", name: "created", onCreate: true },
        { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
      ],
    });
    app.save(conversations);

    // ------------------------------------------------------------------- messages
    const messages = new Collection({
      type: "base",
      name: "messages",
      listRule: '@request.auth.id != "" && conversation.members.id ?= @request.auth.id',
      viewRule: '@request.auth.id != "" && conversation.members.id ?= @request.auth.id',
      createRule:
        '@request.auth.id != "" && sender = @request.auth.id && conversation.members.id ?= @request.auth.id',
      updateRule: '@request.auth.id != "" && sender = @request.auth.id',
      deleteRule: '@request.auth.id != "" && sender = @request.auth.id',
      fields: [
        { type: "relation", name: "business", required: true, maxSelect: 1, collectionId: businesses.id, cascadeDelete: true },
        { type: "relation", name: "conversation", required: true, maxSelect: 1, collectionId: conversations.id, cascadeDelete: true },
        { type: "relation", name: "sender", required: true, maxSelect: 1, collectionId: users.id, cascadeDelete: false },
        { type: "text", name: "text", required: true, max: 4000 },
        { type: "autodate", name: "created", onCreate: true },
      ],
      indexes: ["CREATE INDEX idx_msg_conversation_created ON messages (conversation, created)"],
    });
    app.save(messages);

    // ------------------------------------------------------------------ audit_log
    const audit = new Collection({
      type: "base",
      name: "audit_log",
      listRule: null, // solo SuperAdmin / servidor
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { type: "relation", name: "business", required: false, maxSelect: 1, collectionId: businesses.id, cascadeDelete: true },
        { type: "relation", name: "actor", required: false, maxSelect: 1, collectionId: users.id, cascadeDelete: false },
        { type: "text", name: "action", required: true, max: 120 },
        { type: "json", name: "meta", maxSize: 200000 },
        { type: "autodate", name: "created", onCreate: true },
      ],
    });
    app.save(audit);
  },
  (app) => {
    // Reversión: borrar colecciones en orden inverso y quitar campos de users.
    for (const n of ["audit_log", "messages", "conversations", "time_entries"]) {
      try {
        app.delete(app.findCollectionByNameOrId(n));
      } catch (_) {}
    }
    try {
      const users = app.findCollectionByNameOrId("users");
      for (const f of ["role", "business", "active", "job_title"]) {
        try {
          users.fields.removeByName(f);
        } catch (_) {}
      }
      app.save(users);
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId("businesses"));
    } catch (_) {}
  },
);
