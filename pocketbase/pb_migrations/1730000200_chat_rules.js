/// <reference path="../pb_data/types.d.ts" />

// Reglas del chat, robustas:
// - Los CANALES (type="channel") son visibles para todo el negocio por regla,
//   sin depender de una lista de miembros (que se quedaría desactualizada).
// - Los mensajes directos (type="dm"/"group") siguen restringidos a sus miembros.
// - Crear mensaje: debes ser el remitente y del mismo negocio (el recorrido de
//   relación múltiple `?=` no se evalúa de forma fiable en reglas de creación).

migrate(
  (app) => {
    const convView =
      '@request.auth.id != "" && ((type = "channel" && business = @request.auth.business) || members.id ?= @request.auth.id)';
    const conv = app.findCollectionByNameOrId("conversations");
    conv.listRule = convView;
    conv.viewRule = convView;
    conv.updateRule = convView;
    app.save(conv);

    const msgView =
      '@request.auth.id != "" && ((conversation.type = "channel" && conversation.business = @request.auth.business) || conversation.members.id ?= @request.auth.id)';
    const msg = app.findCollectionByNameOrId("messages");
    msg.listRule = msgView;
    msg.viewRule = msgView;
    msg.createRule = '@request.auth.id != "" && sender = @request.auth.id && business = @request.auth.business';
    app.save(msg);
  },
  (app) => {
    const conv = app.findCollectionByNameOrId("conversations");
    conv.listRule = '@request.auth.id != "" && members.id ?= @request.auth.id';
    conv.viewRule = '@request.auth.id != "" && members.id ?= @request.auth.id';
    conv.updateRule = '@request.auth.id != "" && members.id ?= @request.auth.id';
    app.save(conv);

    const msg = app.findCollectionByNameOrId("messages");
    msg.listRule = '@request.auth.id != "" && conversation.members.id ?= @request.auth.id';
    msg.viewRule = '@request.auth.id != "" && conversation.members.id ?= @request.auth.id';
    msg.createRule =
      '@request.auth.id != "" && sender = @request.auth.id && conversation.members.id ?= @request.auth.id';
    app.save(msg);
  },
);
