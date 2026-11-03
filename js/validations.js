// Reglas de entrada y secuencia de movimientos, compartidas por la interfaz y las pruebas.
export function normalizarCedula(cedula) {
  return String(cedula ?? "").trim();
}

export function normalizarTexto(datos = {}) {
  return String(datos ?? "").trim().replace(/\s+/gu, " ");
}

export function normalizarCorreo(correo) {
  return String(correo ?? "").trim();
}

export function normalizarDatosVisitante(datos = {}) {
  return {
    Nombre_Completo: normalizarTexto(datos.Nombre_Completo),
    Email: normalizarCorreo(datos.Email),
    RH: String(datos.RH ?? "").trim(),
    EPS: normalizarTexto(datos.EPS),
    ARL: normalizarTexto(datos.ARL),
    Persona_Contacto: normalizarTexto(datos.Persona_Contacto),
    Telefono_Contacto: String(datos.Telefono_Contacto ?? "")
  };
}

export function validarCedula(cedula) {
  const valor = normalizarCedula(cedula);
  return /^\d{5,15}$/.test(valor)
    ? { valida: true, mensaje: "" }
    : { valida: false, mensaje: "Revisa el número de documento: debe tener entre 5 y 15 dígitos, sin puntos ni espacios." };
}

export function validarNombre(nombre, etiqueta = "nombre") {
  const valor = normalizarTexto(nombre);
  if (!valor) return { valida: false, mensaje: `Escribe ${etiqueta}.` };
  return /^\p{L}[\p{L}\p{M}]*(?:[ '\u2019-]\p{L}[\p{L}\p{M}]*)*$/u.test(valor)
    ? { valida: true, mensaje: "" }
    : { valida: false, mensaje: "Usa solo letras, espacios, guiones o apóstrofos; no incluyas números ni símbolos." };
}

export function validarCorreo(correo) {
  const valor = normalizarCorreo(correo);
  if (!valor) return { valida: false, mensaje: "Escribe tu correo electrónico." };
  const estructuraValida = /^[^\s@]+@[^\s@]+$/u.test(valor);
  return estructuraValida
    ? { valida: true, mensaje: "" }
    : { valida: false, mensaje: "Revisa el correo. Debe tener un formato como nombre@dominio.com." };
}

export const OPCIONES_RH = Object.freeze(["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"]);

export function validarTelefono(telefono) {
  const valor = String(telefono ?? "");
  if (!valor) return { valida: false, mensaje: "Escribe el teléfono de contacto." };
  return /^\d{1,30}$/u.test(valor)
    ? { valida: true, mensaje: "" }
    : { valida: false, mensaje: "Usa solo números, sin espacios ni símbolos (máximo 30 dígitos)." };
}

export function validarDescripcionElementos(descripcion) {
  const valor = String(descripcion ?? "").trim();
  if (!valor) return { valida: false, mensaje: "Describe los elementos que ingresan." };
  if (valor.length > 500) return { valida: false, mensaje: "La descripción no puede superar 500 caracteres." };
  if (!/^[\p{L}\p{M}\p{N}\s.,;:()/_\-+'’&#%]+$/u.test(valor)) {
    return { valida: false, mensaje: "Usa letras, números, espacios y signos de puntuación habituales." };
  }
  return { valida: true, mensaje: "" };
}

export function validarDatosVisitante(datos = {}) {
  const normalizados = normalizarDatosVisitante(datos);
  const validaciones = [
    ["Nombre_Completo", validarNombre(normalizados.Nombre_Completo, "tu nombre completo")],
    ["Email", validarCorreo(normalizados.Email)],
    ["RH", normalizados.RH && !OPCIONES_RH.includes(normalizados.RH)
      ? { valida: false, mensaje: "Selecciona una de las opciones de RH." }
      : normalizados.RH
        ? { valida: true, mensaje: "" }
        : { valida: false, mensaje: "Selecciona tu tipo de sangre (RH)." }],
    ["EPS", normalizados.EPS ? { valida: true, mensaje: "" } : { valida: false, mensaje: "Escribe el nombre de tu EPS." }],
    ["ARL", normalizados.ARL ? { valida: true, mensaje: "" } : { valida: false, mensaje: "Escribe el nombre de tu ARL." }],
    ["Persona_Contacto", validarNombre(normalizados.Persona_Contacto, "el nombre de la persona de contacto")],
    ["Telefono_Contacto", validarTelefono(normalizados.Telefono_Contacto)]
  ];
  const errores = Object.fromEntries(validaciones
    .filter(([, validacion]) => !validacion.valida)
    .map(([campo, validacion]) => [campo, validacion.mensaje]));
  const primerError = validaciones.find(([, validacion]) => !validacion.valida)?.[1];
  return {
    valida: Object.keys(errores).length === 0,
    mensaje: primerError?.mensaje ?? "",
    errores,
    datos: normalizados
  };
}

export function validarMovimiento(registros, cedula, movimiento, tipoRegistroActual = "") {
  if (!["Ingreso", "Salida"].includes(movimiento)) {
    return { valido: false, mensaje: "No se puede registrar esta acción. Inténtalo nuevamente." };
  }
  const normalizada = normalizarCedula(cedula);
  const ultimoLocal = [...registros]
    .filter((registro) => normalizarCedula(registro.Nro_Documento ?? registro.cedula) === normalizada)
    .sort((a, b) => Date.parse(b.FechaHora_Movimiento ?? b.timestamp) - Date.parse(a.FechaHora_Movimiento ?? a.timestamp))[0];
  const ultimo = tipoRegistroActual
    ? { Tipo_Registro: tipoRegistroActual }
    : ultimoLocal
      ? { Tipo_Registro: ultimoLocal.Tipo_Registro ?? (ultimoLocal.movimiento === "INGRESO" ? "Ingreso" : "Salida") }
      : null;

  if (movimiento === "Ingreso" && ultimo?.Tipo_Registro === "Ingreso") {
    return { valido: false, mensaje: "Ya hay un ingreso activo. Registra la salida antes de volver a ingresar." };
  }
  if (movimiento === "Salida" && ultimo?.Tipo_Registro !== "Ingreso") {
    return { valido: false, mensaje: "No hay un ingreso pendiente de salida para este documento." };
  }
  return { valido: true, mensaje: "" };
}
