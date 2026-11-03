export function presentarErrorUsuario(tipo, detalleTecnico) {
  // El detalle se conserva en diagnósticos internos, nunca en el texto para la interfaz.
  void detalleTecnico;
  if (tipo === "consulta") {
    return "No pudimos consultar tus datos. Inténtalo nuevamente. Si el problema continúa, comunícate con el área de IT Colombia.";
  }
  if (tipo === "registro") {
    return "No pudimos confirmar el resultado del registro. Es posible que se haya guardado; verifica con recepción antes de intentar nuevamente.";
  }
  throw new Error(`Tipo de error de usuario no reconocido: ${tipo}`);
}
