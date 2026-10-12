const FIELD_LABEL: Record<string, string> = {
  email: "el correo",
  password: "la contraseña",
  name: "el nombre",
  slug: "el nombre del negocio",
  role: "el rol",
};

type PbErrorData = Record<string, { code?: string; message?: string }>;

/** Traduce los errores de validación de PocketBase (en inglés) a mensajes claros en español. */
export function friendlyPbError(e: unknown, fallback: string): string {
  const data = (e as { response?: { data?: PbErrorData } })?.response?.data;
  if (!data || !Object.keys(data).length) return fallback;
  const msgs = Object.entries(data).map(([field, d]) => {
    const label = FIELD_LABEL[field] ?? `«${field}»`;
    switch (d?.code) {
      case "validation_not_unique":
        return field === "email"
          ? "Ese correo ya está registrado. Entra con él desde «Entrar» o usa otro correo."
          : `Ya existe un registro con ${label}. Prueba con otro.`;
      case "validation_required":
        return `Falta rellenar ${label}.`;
      case "validation_is_email":
        return "El correo no tiene un formato válido.";
      case "validation_length_out_of_range":
      case "validation_min_text_constraint":
        return `Revisa la longitud de ${label}.`;
      default:
        return d?.message && !/^[A-Za-z]/.test(d.message) ? d.message : `Revisa ${label}.`;
    }
  });
  return Array.from(new Set(msgs)).join(" ");
}
