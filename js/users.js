// Contratos de persona compatibles con las columnas de las listas SharePoint.
// Los datos reales se consultan por Power Automate; no se incluyen en el frontend.
export const CAMPOS_PERSONA_SHAREPOINT = Object.freeze([
  "Nro_Documento",
  "Nombre_Completo",
  "Email",
  "RH",
  "EPS",
  "ARL",
  "Persona_Contacto",
  "Telefono_Contacto",
  "Estado"
]);

export function normalizarPersonaSharePoint(origen = {}) {
  return {
    ID: origen.ID ?? null,
    Nro_Documento: String(origen.Nro_Documento ?? origen.cedula ?? "").trim(),
    Nombre_Completo: String(origen.Nombre_Completo ?? origen.nombre ?? "").trim(),
    Email: String(origen.Email ?? origen.email ?? "").trim(),
    RH: String(origen.RH ?? "").trim(),
    EPS: String(origen.EPS ?? "").trim(),
    ARL: String(origen.ARL ?? "").trim(),
    Persona_Contacto: String(origen.Persona_Contacto ?? "").trim(),
    Telefono_Contacto: String(origen.Telefono_Contacto ?? "").trim(),
    Estado: String(origen.Estado ?? "").trim()
  };
}
