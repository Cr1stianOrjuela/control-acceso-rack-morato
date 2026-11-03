import { CONFIG } from "./config.js";
import { CAMPOS_PERSONA_SHAREPOINT, normalizarPersonaSharePoint } from "./users.js";

export const POWER_AUTOMATE_TIMEOUT_MS = 30_000;

async function postAutomate(payload) {
  if (!CONFIG.POWER_AUTOMATE_URL.trim()) {
    throw new Error("Falta configurar la URL de Power Automate.");
  }
  const controlador = new AbortController();
  const timeoutId = setTimeout(() => controlador.abort(), POWER_AUTOMATE_TIMEOUT_MS);
  try {
    const respuesta = await fetch(CONFIG.POWER_AUTOMATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controlador.signal
    });
    if (!respuesta.ok) {
      const error = new Error(`Power Automate respondió HTTP ${respuesta.status}.`);
      error.name = "PowerAutomateHttpError";
      error.status = respuesta.status;
      throw error;
    }

    const texto = await respuesta.text();
    let cuerpo;
    try {
      cuerpo = JSON.parse(texto);
    } catch {
      throw new Error("Power Automate respondió con un JSON no válido.");
    }
    if (!cuerpo || typeof cuerpo !== "object" || Array.isArray(cuerpo)) {
      throw new Error("Power Automate respondió sin un objeto JSON válido.");
    }
    return cuerpo;
  } catch (error) {
    if (controlador.signal.aborted) {
      const timeoutError = new Error("La solicitud a Power Automate excedió el tiempo máximo de espera.");
      timeoutError.name = "PowerAutomateTimeoutError";
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Power Automate consulta las dos listas base y devuelve el perfil y el último movimiento.
export async function consultarPersonaPowerAutomate(nroDocumento) {
  const respuesta = await postAutomate({
    accion: "CONSULTAR_PERSONA",
    Nro_Documento: String(nroDocumento).trim()
  });
  const datosRespuesta = respuesta.body && typeof respuesta.body === "object" && !Array.isArray(respuesta.body)
    ? respuesta.body
    : respuesta;
  if (
    respuesta.success === false
    || (respuesta.error !== undefined && respuesta.error !== null && respuesta.error !== "")
    || datosRespuesta.success === false
    || (datosRespuesta.error !== undefined && datosRespuesta.error !== null && datosRespuesta.error !== "")
  ) {
    throw new Error("Power Automate indicó un error durante la consulta de la persona o sus movimientos.");
  }
  if (typeof datosRespuesta.encontrado !== "boolean") {
    throw new Error("La respuesta de consulta debe incluir encontrado: true o false.");
  }
  if (!datosRespuesta.encontrado) return { encontrado: false, persona: null, ultimoMovimiento: null };
  const persona = normalizarPersonaSharePoint(datosRespuesta.persona ?? datosRespuesta);
  if (!persona.Nro_Documento || !persona.Nombre_Completo) {
    throw new Error("Power Automate encontró a la persona, pero la respuesta no incluye Nro_Documento y Nombre_Completo.");
  }
  if (!persona.Estado) {
    throw new Error("Power Automate encontró a la persona, pero no devolvió la columna Estado.");
  }
  const tipoUsuario = datosRespuesta.tipoUsuario ?? datosRespuesta.Tipo_Usuario;
  if (!["Interno", "Visitante"].includes(tipoUsuario)) {
    throw new Error("La respuesta de consulta debe indicar tipoUsuario: Interno o Visitante.");
  }
  return {
    encontrado: true,
    persona,
    tipoUsuario,
    ultimoMovimiento: normalizarUltimoMovimiento(datosRespuesta)
  };
}

function normalizarUltimoMovimiento(respuesta) {
  const tienePropiedadUltimo = Object.hasOwn(respuesta, "ultimoMovimiento");
  const tieneColeccionRaiz = Object.hasOwn(respuesta, "value");
  if (!tienePropiedadUltimo && !tieneColeccionRaiz) {
    throw new Error("La respuesta de consulta debe incluir ultimoMovimiento o una colección value explícita.");
  }

  const resultado = tienePropiedadUltimo ? respuesta.ultimoMovimiento : respuesta.value;
  if (resultado === null) return null;

  let movimientos;
  if (Array.isArray(resultado)) {
    movimientos = resultado;
  } else if (resultado && typeof resultado === "object") {
    const cuerpo = resultado.body;
    if (
      resultado.success === false
      || (resultado.error !== undefined && resultado.error !== null && resultado.error !== "")
      || cuerpo?.success === false
      || (cuerpo?.error !== undefined && cuerpo.error !== null && cuerpo.error !== "")
    ) {
      throw new Error("Power Automate indicó un error al consultar el último movimiento.");
    }
    if (Array.isArray(resultado.value)) {
      movimientos = resultado.value;
    } else if (resultado.body && Array.isArray(resultado.body.value)) {
      movimientos = resultado.body.value;
    } else if (typeof resultado.Tipo_Registro === "string") {
      movimientos = [resultado];
    } else {
      throw new Error("ultimoMovimiento debe ser null, un movimiento o una colección value.");
    }
  } else {
    throw new Error("ultimoMovimiento tiene un formato no válido.");
  }

  if (movimientos.length === 0) return null;
  for (const movimiento of movimientos) {
    if (!movimiento || !["Ingreso", "Salida"].includes(movimiento.Tipo_Registro)) {
      throw new Error("Cada movimiento consultado debe incluir Tipo_Registro: Ingreso o Salida.");
    }
  }
  if (movimientos.length === 1) return movimientos[0];

  const ordenados = movimientos.map((movimiento) => ({
    movimiento,
    fecha: Date.parse(movimiento.FechaHora_Movimiento)
  }));
  if (ordenados.some(({ fecha }) => !Number.isFinite(fecha))) {
    throw new Error("No se pudo determinar el movimiento más reciente: FechaHora_Movimiento no es válida.");
  }
  ordenados.sort((a, b) => b.fecha - a.fecha);
  return ordenados[0].movimiento;
}

// Las columnas enviadas son las de SharePoint; accion solo enruta la operación en el flujo.
export async function enviarMovimientoPowerAutomate(registro) {
  const accion = registro.crearVisitante
    ? "CREAR_VISITANTE_Y_REGISTRAR_INGRESO"
    : registro.Tipo_Usuario === "Interno"
      ? "REGISTRAR_MOVIMIENTO_INTERNO"
      : "REGISTRAR_MOVIMIENTO_VISITANTE";
  const payload = {
    accion,
    ...Object.fromEntries(CAMPOS_PERSONA_SHAREPOINT
      .filter((campo) => campo !== "Estado")
      .map((campo) => [campo, registro[campo] ?? ""])),
    Title: registro.Title,
    FechaHora_Movimiento: registro.FechaHora_Movimiento,
    Tipo_Registro: registro.Tipo_Registro,
    Equipo_Tecnologico: registro.Equipo_Tecnologico
  };
  if (registro.crearVisitante) payload.Estado = "Activo";
  const respuesta = await postAutomate(payload);
  const cuerpoRespuesta = respuesta.body && typeof respuesta.body === "object" && !Array.isArray(respuesta.body)
    ? respuesta.body
    : respuesta;
  if (
    respuesta.success === false
    || (respuesta.error !== undefined && respuesta.error !== null && respuesta.error !== "")
    || cuerpoRespuesta.success === false
    || (cuerpoRespuesta.error !== undefined && cuerpoRespuesta.error !== null && cuerpoRespuesta.error !== "")
  ) {
    throw new Error("Power Automate indicó un error al registrar el movimiento.");
  }
  const mensaje = typeof cuerpoRespuesta.mensaje === "string" ? cuerpoRespuesta.mensaje.trim() : "";
  if (respuesta.success !== true && cuerpoRespuesta.success !== true && !mensaje) {
    throw new Error("Power Automate no devolvió una confirmación reconocible del registro.");
  }
  return {
    enviado: true,
    mensaje: typeof cuerpoRespuesta.mensaje === "string" ? cuerpoRespuesta.mensaje : ""
  };
}
