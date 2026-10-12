/// <reference path="../pb_data/types.d.ts" />

// Ajusta las reglas de acceso para el panel de administración:
// - Managers/dueños pueden LISTAR y VER a los empleados de SU negocio.
// - La creación/edición de usuarios se hace SOLO desde el servidor (rutas API con
//   credenciales de administrador), evitando que un empleado se auto-ascienda.
// - Los fichajes: cada empleado ve los suyos; managers/dueños ven los de todo el equipo.

migrate(
  (app) => {
    const sameBusinessStaff =
      '@request.auth.id != "" && (id = @request.auth.id || (business = @request.auth.business && (@request.auth.role = "owner" || @request.auth.role = "manager")))';

    const users = app.findCollectionByNameOrId("users");
    users.listRule = sameBusinessStaff;
    users.viewRule = sameBusinessStaff;
    users.createRule = null; // solo servidor/superadmin
    users.updateRule = null; // solo servidor/superadmin
    users.deleteRule = null; // se desactiva con el campo `active`, no se borra
    app.save(users);

    const te = app.findCollectionByNameOrId("time_entries");
    const teView =
      '@request.auth.id != "" && business = @request.auth.business && (user = @request.auth.id || @request.auth.role = "owner" || @request.auth.role = "manager")';
    te.listRule = teView;
    te.viewRule = teView;
    app.save(te);
  },
  (app) => {
    // Reversión a las reglas de la migración inicial.
    const users = app.findCollectionByNameOrId("users");
    users.listRule = "id = @request.auth.id";
    users.viewRule = "id = @request.auth.id";
    users.createRule = "";
    users.updateRule = "id = @request.auth.id";
    users.deleteRule = "id = @request.auth.id";
    app.save(users);

    const te = app.findCollectionByNameOrId("time_entries");
    te.listRule = '@request.auth.id != "" && business = @request.auth.business';
    te.viewRule = '@request.auth.id != "" && business = @request.auth.business';
    app.save(te);
  },
);
