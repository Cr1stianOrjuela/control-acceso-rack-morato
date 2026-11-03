// Sustituir marcadores de responsable, finalidades, categorías, derechos, canales, política,
// versión y vigencia por los datos y textos aprobados por Legal antes de habilitar en producción.
export const AVISO_PRIVACIDAD = Object.freeze({
  title: "Tratamiento de datos personales",
  subtitle: "Antes de registrar tu ingreso, necesitamos tu autorización",
  provisionalWarning: "Contenido provisional de desarrollo. Pendiente de aprobación por el área legal de Inchcape.",
  persistenceWarning: "La aceptación de esta pantalla no se almacena como evidencia en SharePoint y no constituye una autorización legal definitiva.",
  version: "[PENDIENTE: VERSIÓN APROBADA DEL AVISO]",
  effectiveDate: "[PENDIENTE: FECHA DE VIGENCIA APROBADA]",
  sections: [
    {
      heading: "Responsable del tratamiento",
      content: "[PENDIENTE: RAZÓN SOCIAL OFICIAL DEL RESPONSABLE]\n[PENDIENTE: IDENTIFICACIÓN OFICIAL DEL RESPONSABLE]"
    },
    {
      heading: "Finalidades del tratamiento",
      content: "[PENDIENTE: FINALIDADES APROBADAS POR EL ÁREA LEGAL]"
    },
    {
      heading: "Datos personales solicitados",
      content: "El formulario solicita número de documento, nombre completo, correo electrónico, RH, EPS, ARL, nombre y teléfono de contacto y, si se indica, una descripción de los elementos que ingresan.\n[PENDIENTE: CATEGORÍAS DE DATOS APROBADAS POR EL ÁREA LEGAL]"
    },
    {
      heading: "Derechos del titular",
      content: "[PENDIENTE: DERECHOS Y MECANISMOS APROBADOS POR EL ÁREA LEGAL]"
    },
    {
      heading: "Canales de atención",
      content: "[PENDIENTE: CANALES OFICIALES DE ATENCIÓN]"
    }
  ],
  policy: {
    heading: "Política de tratamiento",
    title: "[PENDIENTE: NOMBRE OFICIAL DE LA POLÍTICA DE TRATAMIENTO]",
    url: "[PENDIENTE: URL OFICIAL DE LA POLÍTICA]"
  },
  authorizationLabel: "He leído y acepto la autorización para el tratamiento de mis datos personales.",
  cancelButtonText: "Cancelar",
  confirmButtonText: "Aceptar y continuar"
});
