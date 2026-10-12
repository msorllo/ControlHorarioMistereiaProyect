/// <reference path="../pb_data/types.d.ts" />

// Corrige el campo `members` de las conversaciones para que sea MULTI-relación.
// `maxSelect: 0` se interpretaba como relación única (guardaba un solo miembro),
// lo que rompía los canales y los mensajes directos (que necesitan 2+ miembros).

migrate(
  (app) => {
    const conv = app.findCollectionByNameOrId("conversations");
    const members = conv.fields.getByName("members");
    members.maxSelect = 999;
    app.save(conv);
  },
  (app) => {
    const conv = app.findCollectionByNameOrId("conversations");
    const members = conv.fields.getByName("members");
    members.maxSelect = 1;
    app.save(conv);
  },
);
