// Separa movimientos confirmados de los pendientes de sincronización.
export const STORAGE_KEY = "morato-rack-registros-confirmados-v2";
export const PENDING_STORAGE_KEY = "morato-rack-registros-pendientes-v1";
export const LEGACY_STORAGE_KEY = "morato-rack-registros-v1";
export const PENDING_TTL_MS = 24 * 60 * 60 * 1000;

const PENDING_FORMAT_VERSION = 1;
const PENDING_RECORD_FIELDS = Object.freeze([
  "local_id",
  "Nro_Documento",
  "Nombre_Completo",
  "Email",
  "RH",
  "EPS",
  "ARL",
  "Persona_Contacto",
  "Telefono_Contacto",
  "Estado",
  "Title",
  "FechaHora_Movimiento",
  "Tipo_Registro",
  "Equipo_Tecnologico",
  "Tipo_Usuario",
  "crearVisitante"
]);

function leerRegistros(clave = STORAGE_KEY) {
  const contenido = localStorage.getItem(clave);
  if (contenido === null) return [];
  const registros = JSON.parse(contenido);
  if (!Array.isArray(registros)) throw new Error("El historial local tiene un formato no válido.");
  return registros;
}

function leerPendientes() {
  const contenido = localStorage.getItem(PENDING_STORAGE_KEY);
  if (contenido === null) return [];
  const almacen = JSON.parse(contenido);
  if (Array.isArray(almacen)) {
    return almacen.map((record) => {
      const fecha = Date.parse(fechaMovimiento(record));
      const createdAt = Number.isFinite(fecha) ? fecha : null;
      return {
        record,
        createdAt,
        expiresAt: createdAt === null ? null : createdAt + PENDING_TTL_MS,
        legacy: true
      };
    });
  }
  if (
    !almacen || almacen.version !== PENDING_FORMAT_VERSION || !Array.isArray(almacen.records) ||
    almacen.records.some((entry) => !entry?.record ||
      (!entry.legacy && (typeof entry.createdAt !== "number" || typeof entry.expiresAt !== "number")) ||
      (entry.legacy && entry.createdAt !== null && typeof entry.createdAt !== "number") ||
      (entry.legacy && entry.expiresAt !== null && typeof entry.expiresAt !== "number"))
  ) {
    throw new Error("La cola local de pendientes tiene un formato no válido.");
  }
  return almacen.records;
}

function guardarPendientes(pendientes) {
  if (pendientes.length === 0) {
    localStorage.removeItem(PENDING_STORAGE_KEY);
    return;
  }
  localStorage.setItem(PENDING_STORAGE_KEY, JSON.stringify({
    version: PENDING_FORMAT_VERSION,
    records: pendientes.map((entry) => entry.legacy
      ? { ...entry, record: minimizarRegistroPendiente(entry.record) }
      : entry)
  }));
}

function minimizarRegistroPendiente(registro) {
  return Object.fromEntries(PENDING_RECORD_FIELDS
    .filter((campo) => Object.hasOwn(registro, campo))
    .map((campo) => [campo, registro[campo]]));
}

function fechaMovimiento(registro) {
  return registro.FechaHora_Movimiento ?? registro.timestamp;
}

function documentoMovimiento(registro) {
  return String(registro.Nro_Documento ?? registro.cedula ?? "").trim();
}

function tipoMovimiento(registro) {
  return registro.Tipo_Registro ?? (registro.movimiento === "INGRESO" ? "Ingreso" : "Salida");
}

export function obtenerRegistros() {
  return leerRegistros().sort((a, b) => Date.parse(fechaMovimiento(b)) - Date.parse(fechaMovimiento(a)));
}

function guardarEnAlmacenamiento(registro, clave) {
  if (!registro?.Nro_Documento || !registro?.FechaHora_Movimiento || !registro?.Tipo_Registro) {
    throw new Error("No se puede guardar un movimiento incompleto.");
  }
  const registros = leerRegistros(clave);
  if (registros.some((actual) => actual.local_id === registro.local_id)) {
    throw new Error("El movimiento ya está guardado.");
  }
  registros.push(registro);
  localStorage.setItem(clave, JSON.stringify(registros));
  return registro;
}

export function guardarRegistro(registro) {
  return guardarEnAlmacenamiento(registro, STORAGE_KEY);
}

export function guardarRegistroPendiente(registro, ahora = Date.now()) {
  if (!registro?.local_id || !registro?.Nro_Documento || !registro?.FechaHora_Movimiento ||
      !registro?.Tipo_Registro) {
    throw new Error("No se puede guardar un movimiento pendiente incompleto.");
  }
  const pendientes = leerPendientes();
  if (pendientes.some((entry) => entry.record.local_id === registro.local_id)) {
    return registro;
  }
  pendientes.push({
    record: minimizarRegistroPendiente(registro),
    createdAt: ahora,
    expiresAt: ahora + PENDING_TTL_MS,
    confirmation: "unconfirmed"
  });
  guardarPendientes(pendientes);
  return registro;
}

export function obtenerResumenRegistrosPendientes(ahora = Date.now()) {
  const pendientes = leerPendientes();
  return pendientes.reduce((resumen, entry) => {
    if (entry.legacy) resumen.legacyCount += 1;
    if (entry.expiresAt !== null && entry.expiresAt <= ahora) {
      resumen.expiredCount += 1;
    } else {
      resumen.activeCount += 1;
    }
    return resumen;
  }, { activeCount: 0, expiredCount: 0, legacyCount: 0 });
}

export function eliminarRegistrosPendientesVencidos(ahora = Date.now()) {
  const pendientes = leerPendientes();
  const vigentes = pendientes.filter((entry) => entry.expiresAt === null || entry.expiresAt > ahora);
  const eliminados = pendientes.length - vigentes.length;
  if (eliminados > 0) guardarPendientes(vigentes);
  return eliminados;
}

export function eliminarRegistroPendiente(localId) {
  if (typeof localId !== "string" || !localId) return false;
  const pendientes = leerPendientes();
  const vigentes = pendientes.filter((entry) => entry.record.local_id !== localId);
  if (vigentes.length === pendientes.length) return false;
  guardarPendientes(vigentes);
  return true;
}

export function obtenerResumenHistorialObsoleto() {
  const contenido = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (contenido === null) return { count: 0, invalid: false };
  try {
    const registros = JSON.parse(contenido);
    return Array.isArray(registros)
      ? { count: registros.length, invalid: false }
      : { count: 0, invalid: true };
  } catch {
    return { count: 0, invalid: true };
  }
}

export function eliminarHistorialObsoleto() {
  const resumen = obtenerResumenHistorialObsoleto();
  if (resumen.invalid) {
    throw new Error("El historial local de una versión anterior tiene un formato no válido.");
  }
  if (resumen.count === 0) return false;
  localStorage.removeItem(LEGACY_STORAGE_KEY);
  return true;
}

export function obtenerEstadoPersona(cedula) {
  const ultimo = obtenerRegistros().find((registro) => documentoMovimiento(registro) === String(cedula).trim());
  return ultimo && tipoMovimiento(ultimo) === "Ingreso" ? "DENTRO" : "FUERA";
}

export function obtenerPersonasDentro() {
  const ultimos = new Map();
  for (const registro of leerRegistros().sort((a, b) => Date.parse(fechaMovimiento(a)) - Date.parse(fechaMovimiento(b)))) {
    ultimos.set(documentoMovimiento(registro), registro);
  }
  return [...ultimos.values()]
    .filter((registro) => tipoMovimiento(registro) === "Ingreso")
    .sort((a, b) => Date.parse(fechaMovimiento(b)) - Date.parse(fechaMovimiento(a)));
}

export function obtenerHistorial(limite = 10) {
  return obtenerRegistros().slice(0, limite);
}
