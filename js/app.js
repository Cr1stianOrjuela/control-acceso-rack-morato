// Orquesta búsqueda, alta de visitantes y movimientos con los contratos SharePoint.
import Swal from "../assets/vendor/sweetalert2/sweetalert2.esm.all.min.js";
import Choices from "../assets/vendor/choices.js/choices.mjs";
import { AVISO_PRIVACIDAD } from "./privacy-notice.js";
import { consultarPersonaPowerAutomate, enviarMovimientoPowerAutomate } from "./api.js";
import {
  normalizarCedula,
  normalizarCorreo,
  normalizarDatosVisitante,
  normalizarTexto,
  validarCedula,
  validarDatosVisitante,
  validarDescripcionElementos,
  validarMovimiento
} from "./validations.js";
import { normalizarPersonaSharePoint } from "./users.js";
import {
  eliminarHistorialObsoleto,
  eliminarRegistroPendiente,
  eliminarRegistrosPendientesVencidos,
  guardarRegistroPendiente,
  obtenerResumenHistorialObsoleto,
  obtenerResumenRegistrosPendientes
} from "./storage.js";
import { presentarErrorUsuario } from "./messages.js";

const identityForm = document.querySelector("#identity-form");
const visitorForm = document.querySelector("#visitor-form");
const cedulaInput = document.querySelector("#cedula");
const identityButton = identityForm.querySelector('button[type="submit"]');
const identityStep = document.querySelector("#identity-step");
const personStep = document.querySelector("#person-step");
const resultStep = document.querySelector("#result-step");
const knownPersonActions = document.querySelector("#known-person-actions");
const actionButton = document.querySelector("#action-button");
const visitorEntryButton = document.querySelector("#visitor-entry-button");
const knownElementEntry = document.querySelector("#known-element-entry");
const visitorElementsCheckbox = document.querySelector("#visitor-elements-checkbox");
const visitorElementsPanel = document.querySelector("#visitor-elements-panel");
const visitorEquipment = document.querySelector("#visitor-equipment");
const knownElementsCheckbox = document.querySelector("#known-elements-checkbox");
const knownElementsPanel = document.querySelector("#known-elements-panel");
const knownEquipment = document.querySelector("#known-equipment");
const message = document.querySelector("#message");
const rhSelect = document.querySelector("#visitor-rh");
const iconUrl = (filename) => new URL(`../assets/icons/${filename}`, import.meta.url).href;
const rhChoices = new Choices(rhSelect, {
  allowHTML: false,
  itemSelectText: "",
  position: "auto",
  searchEnabled: false,
  shouldSort: false
});
rhChoices.containerOuter.element.setAttribute("aria-describedby", rhSelect.getAttribute("aria-describedby"));
rhChoices.containerOuter.element.setAttribute("aria-required", "true");

let personaActual = null;
let operacionEnCurso = false;
let registroVisitanteEnCurso = false;
let consultaEnCurso = false;

function registrarDiagnosticoSeguro(etapa, error, accion = "") {
  const tipoError = [
    "Error", "TypeError", "PowerAutomateHttpError", "PowerAutomateTimeoutError", "QuotaExceededError"
  ]
    .includes(error?.name) ? error.name : "Error";
  const detalles = { etapa, tipoError };
  if (accion) detalles.accion = accion;
  if (Number.isInteger(error?.status)) detalles.estadoHttp = error.status;
  console.error("Operación de control de acceso no completada.", detalles);
}

function escaparHtml(texto) {
  return String(texto).replace(/[&<>"']/g, (caracter) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[caracter]);
}

function crearContenidoAvisoPrivacidad() {
  const secciones = AVISO_PRIVACIDAD.sections.map((seccion) => `
    <section class="privacy-notice__section">
      <h3>${escaparHtml(seccion.heading)}</h3>
      <p>${escaparHtml(seccion.content).replace(/\n/g, "<br>")}</p>
    </section>
  `).join("");
  let referenciaPolitica = escaparHtml(AVISO_PRIVACIDAD.policy.title);
  try {
    const url = new URL(AVISO_PRIVACIDAD.policy.url);
    if (["http:", "https:"].includes(url.protocol)) {
      referenciaPolitica = `<a href="${escaparHtml(url.href)}" target="_blank" rel="noopener noreferrer">${referenciaPolitica}</a>`;
    }
  } catch {
    // El enlace queda como marcador visible hasta que se configure una URL oficial.
  }

  return `
    <div class="privacy-notice">
      <div class="privacy-notice__intro">
        <img src="${iconUrl("shield-check.svg")}" alt="" aria-hidden="true">
        <p>${escaparHtml(AVISO_PRIVACIDAD.subtitle)}</p>
      </div>
      <div class="privacy-notice__warning" id="privacy-notice-warning" role="note">
        <strong>${escaparHtml(AVISO_PRIVACIDAD.provisionalWarning)}</strong>
        <span>${escaparHtml(AVISO_PRIVACIDAD.persistenceWarning)}</span>
      </div>
      <div class="privacy-notice__content" tabindex="0" aria-label="Contenido del aviso provisional">
        <p class="privacy-notice__version">Versión: ${escaparHtml(AVISO_PRIVACIDAD.version)} · Vigencia: ${escaparHtml(AVISO_PRIVACIDAD.effectiveDate)}</p>
        ${secciones}
        <section class="privacy-notice__section">
          <h3>${escaparHtml(AVISO_PRIVACIDAD.policy.heading)}</h3>
          <p>${referenciaPolitica}</p>
        </section>
        <label class="privacy-notice__consent" for="privacy-notice-consent">
          <input id="privacy-notice-consent" type="checkbox" aria-describedby="privacy-notice-warning">
          <span>${escaparHtml(AVISO_PRIVACIDAD.authorizationLabel)}</span>
        </label>
      </div>
    </div>
  `;
}

function mostrarAvisoPrivacidad() {
  return Swal.fire({
    title: AVISO_PRIVACIDAD.title,
    html: crearContenidoAvisoPrivacidad(),
    showCancelButton: true,
    cancelButtonText: AVISO_PRIVACIDAD.cancelButtonText,
    confirmButtonText: AVISO_PRIVACIDAD.confirmButtonText,
    buttonsStyling: false,
    reverseButtons: true,
    focusCancel: true,
    allowOutsideClick: false,
    allowEscapeKey: true,
    heightAuto: false,
    customClass: {
      popup: "morato-alert privacy-consent-popup",
      title: "morato-alert__title privacy-consent__title",
      htmlContainer: "morato-alert__text privacy-consent__body",
      actions: "privacy-consent__actions",
      confirmButton: "morato-alert__confirm privacy-consent__confirm",
      cancelButton: "privacy-consent__cancel"
    },
    didOpen: () => {
      const checkbox = Swal.getHtmlContainer().querySelector("#privacy-notice-consent");
      const confirmButton = Swal.getConfirmButton();
      confirmButton.disabled = true;
      checkbox.addEventListener("change", () => {
        confirmButton.disabled = !checkbox.checked;
      });
    }
  });
}

function obtenerHuellaFormularioVisitante() {
  return JSON.stringify([...visitorForm.querySelectorAll("input, select, textarea")].map((campo) => [
    campo.id,
    campo.type === "checkbox" ? campo.checked : campo.value
  ]));
}

function configurarControlElementos(checkbox, panel, descripcion) {
  const actualizar = () => {
    const expandido = checkbox.checked;
    panel.classList.toggle("is-expanded", expandido);
    panel.setAttribute("aria-hidden", String(!expandido));
    checkbox.setAttribute("aria-expanded", String(expandido));
    descripcion.disabled = !expandido;
    descripcion.required = expandido;
    if (!expandido) {
      descripcion.value = "";
      actualizarErrorCampo(descripcion);
    }
  };
  checkbox.addEventListener("change", actualizar);
  actualizar();
  return actualizar;
}

const actualizarElementosVisitante = configurarControlElementos(
  visitorElementsCheckbox,
  visitorElementsPanel,
  visitorEquipment
);
const actualizarElementosPersonaConocida = configurarControlElementos(
  knownElementsCheckbox,
  knownElementsPanel,
  knownEquipment
);

function mostrarError(texto) {
  message.textContent = texto;
  message.className = "message message--error";
  message.hidden = false;
}

function ocultarError() {
  message.textContent = "";
  message.hidden = true;
}

function actualizarErrorCampo(campo, mensaje = "") {
  const error = document.querySelector(`#${campo.id}-error`);
  campo.setAttribute("aria-invalid", String(Boolean(mensaje)));
  if (campo === rhSelect) {
    rhChoices.containerOuter.element.classList.toggle("is-invalid", Boolean(mensaje));
    rhChoices.containerOuter.element.setAttribute("aria-invalid", String(Boolean(mensaje)));
    rhChoices.containerOuter.element.setAttribute("aria-describedby", campo.getAttribute("aria-describedby"));
  }
  if (!error) return;
  error.textContent = mensaje;
  error.hidden = !mensaje;
}

function leerDatosFormularioVisitante() {
  return {
    Nombre_Completo: document.querySelector("#visitor-name").value,
    Email: document.querySelector("#visitor-email").value,
    RH: document.querySelector("#visitor-rh").value,
    EPS: document.querySelector("#visitor-eps").value,
    ARL: document.querySelector("#visitor-arl").value,
    Persona_Contacto: document.querySelector("#visitor-contact").value,
    Telefono_Contacto: document.querySelector("#visitor-phone").value
  };
}

function validarCampoVisitante(campo) {
  const camposPorId = {
    "visitor-name": "Nombre_Completo",
    "visitor-email": "Email",
    "visitor-rh": "RH",
    "visitor-eps": "EPS",
    "visitor-arl": "ARL",
    "visitor-contact": "Persona_Contacto",
    "visitor-phone": "Telefono_Contacto"
  };
  if (campo.id === "visitor-name" || campo.id === "visitor-contact" ||
      campo.id === "visitor-eps" || campo.id === "visitor-arl") {
    campo.value = normalizarTexto(campo.value);
  } else if (campo.id === "visitor-email") {
    campo.value = normalizarCorreo(campo.value);
  } else if (campo.id === "visitor-rh") {
    campo.value = campo.value.trim();
  }
  const nombreCampo = camposPorId[campo.id];
  if (!nombreCampo) return true;
  const mensajeValidacion = validarDatosVisitante(leerDatosFormularioVisitante()).errores[nombreCampo] ?? "";
  const mensaje = campo.id === "visitor-email" && !mensajeValidacion && !campo.validity.valid
    ? "Revisa el formato del correo electrónico."
    : mensajeValidacion;
  actualizarErrorCampo(campo, mensaje);
  return !mensaje;
}

function configurarValidacionCampos() {
  const camposVisitante = [...visitorForm.querySelectorAll("input, select")];
  visitorForm.addEventListener("focusout", (evento) => {
    if (camposVisitante.includes(evento.target) || evento.target === rhChoices.containerOuter.element) {
      const campo = evento.target === rhChoices.containerOuter.element ? rhSelect : evento.target;
      validarCampoVisitante(campo);
    }
    if (evento.target === visitorEquipment && visitorElementsCheckbox.checked) {
      const resultado = validarDescripcionElementos(visitorEquipment.value);
      actualizarErrorCampo(visitorEquipment, resultado.mensaje);
    }
  });
  visitorForm.addEventListener("change", (evento) => {
    if (evento.target === rhSelect) actualizarErrorCampo(rhSelect);
  });
  identityForm.addEventListener("focusout", (evento) => {
    if (evento.target !== cedulaInput) return;
    actualizarErrorCampo(cedulaInput, validarCedula(cedulaInput.value).mensaje);
  });
  visitorForm.addEventListener("input", (evento) => {
    if (camposVisitante.includes(evento.target) || evento.target === visitorEquipment) {
      actualizarErrorCampo(evento.target);
    }
  });
  identityForm.addEventListener("input", () => actualizarErrorCampo(cedulaInput));
  for (const campo of [visitorEquipment, knownEquipment]) {
    campo.addEventListener("input", () => actualizarErrorCampo(campo));
  }
}

function leerElementosIngresantes(checkbox, descripcion) {
  if (!checkbox.checked) {
    actualizarErrorCampo(descripcion);
    return "No ingresa con elemento";
  }
  const validacion = validarDescripcionElementos(descripcion.value);
  if (!validacion.valida) {
    actualizarErrorCampo(descripcion, validacion.mensaje);
    descripcion.focus();
    return null;
  }
  actualizarErrorCampo(descripcion);
  return descripcion.value.trim();
}

function actualizarReloj() {
  const ahora = new Date();
  document.querySelector("#current-time").textContent = new Intl.DateTimeFormat("es-CO", {
    hour: "2-digit", minute: "2-digit", hour12: true
  }).format(ahora);
  document.querySelector("#current-date").textContent = new Intl.DateTimeFormat("es-CO", {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
  }).format(ahora);
}

function leerUltimoMovimiento(respuesta) {
  return respuesta.ultimoMovimiento?.Tipo_Registro ?? "";
}

function prepararMovimiento(persona, tipoUsuario, ultimoMovimiento) {
  const tipoRegistro = ultimoMovimiento === "Ingreso" ? "Salida" : "Ingreso";
  personaActual = { ...persona, Tipo_Usuario: tipoUsuario, tipoRegistro, ultimoTipoRegistro: ultimoMovimiento };
  const indicadorPersona = personStep.querySelector(".step-number");
  indicadorPersona.innerHTML = `<img class="step-number__icon" src="${iconUrl("circle-check.svg")}" alt="">`;
  indicadorPersona.classList.add("step-number--green");
  knownElementEntry.hidden = tipoRegistro !== "Ingreso";
  knownElementsCheckbox.checked = false;
  actualizarElementosPersonaConocida();
  identityStep.hidden = true;
  personStep.hidden = false;
  visitorForm.hidden = true;
  knownPersonActions.hidden = false;
  document.querySelector("#person-kind").textContent = tipoUsuario === "Interno"
    ? "PERSONAL INTERNO"
    : "VISITANTE";
  document.querySelector("#person-name").textContent = `Hola, ${persona.Nombre_Completo}`;
  document.querySelector("#person-guidance").textContent = tipoRegistro === "Ingreso"
    ? "Te identificamos correctamente. Ahora registra tu ingreso."
    : "Te identificamos correctamente. Ahora registra tu salida.";
  actionButton.dataset.movement = tipoRegistro;
  actionButton.innerHTML = tipoRegistro === "Ingreso"
    ? `Registrar ingreso <img class="button__icon" src="${iconUrl("arrow-right.svg")}" alt="" aria-hidden="true">`
    : `Registrar salida <img class="button__icon" src="${iconUrl("log-out.svg")}" alt="" aria-hidden="true">`;
}

async function identificarPersona(evento) {
  evento.preventDefault();
  if (consultaEnCurso) return;
  ocultarError();
  const nroDocumento = normalizarCedula(cedulaInput.value);
  cedulaInput.value = nroDocumento;
  const validacion = validarCedula(nroDocumento);
  if (!validacion.valida) {
    actualizarErrorCampo(cedulaInput, validacion.mensaje);
    cedulaInput.focus();
    return;
  }
  actualizarErrorCampo(cedulaInput);
  consultaEnCurso = true;
  identityButton.disabled = true;
  identityButton.classList.add("is-loading");
  identityButton.setAttribute("aria-busy", "true");
  identityButton.textContent = "Consultando…";
  try {
    const respuesta = await consultarPersonaPowerAutomate(nroDocumento);
    if (!respuesta.encontrado) {
      personaActual = normalizarPersonaSharePoint({ Nro_Documento: nroDocumento });
      const indicadorPersona = personStep.querySelector(".step-number");
      indicadorPersona.textContent = "01";
      indicadorPersona.classList.remove("step-number--green");
      identityStep.hidden = true;
      personStep.hidden = false;
      visitorForm.hidden = false;
      knownPersonActions.hidden = true;
      document.querySelector("#person-kind").textContent = "PRIMERA VISITA";
      document.querySelector("#person-name").textContent = "No encontramos información asociada a este documento";
      document.querySelector("#person-guidance").textContent = "Si es tu primera visita, completa los siguientes datos para continuar con el registro.";
      document.querySelector("#visitor-name").focus();
      return;
    }

    if (respuesta.persona.Estado.toLocaleLowerCase("es-CO") !== "activo") {
      mostrarError("No es posible continuar con este documento. Comunícate con el área de IT Colombia para recibir asistencia.");
      return;
    }
    prepararMovimiento(respuesta.persona, respuesta.tipoUsuario, leerUltimoMovimiento(respuesta));
  } catch (error) {
    registrarDiagnosticoSeguro("consulta");
    mostrarError(presentarErrorUsuario("consulta", error));
  } finally {
    consultaEnCurso = false;
    identityButton.disabled = false;
    identityButton.classList.remove("is-loading");
    identityButton.removeAttribute("aria-busy");
    identityButton.innerHTML = `Continuar <img class="button__icon" src="${iconUrl("arrow-right.svg")}" alt="" aria-hidden="true">`;
  }
}

function construirMovimiento(persona, tipoRegistro, equipoTecnologico, crearVisitante = false) {
  const ahora = new Date();
  const fechaHora = ahora.toISOString();
  const registro = {
    local_id: crypto.randomUUID(),
    Nro_Documento: persona.Nro_Documento,
    Nombre_Completo: persona.Nombre_Completo,
    Email: persona.Email,
    RH: persona.RH,
    EPS: persona.EPS,
    ARL: persona.ARL,
    Persona_Contacto: persona.Persona_Contacto,
    Telefono_Contacto: persona.Telefono_Contacto,
    Estado: persona.Estado,
    Title: `${tipoRegistro} - ${persona.Nombre_Completo}`,
    FechaHora_Movimiento: fechaHora,
    Tipo_Registro: tipoRegistro,
    Equipo_Tecnologico: equipoTecnologico.trim(),
    Tipo_Usuario: persona.Tipo_Usuario,
    crearVisitante
  };
  return registro;
}

function restaurarFormularioTrasError(crearVisitante) {
  resultStep.hidden = true;
  identityStep.hidden = true;
  personStep.hidden = false;
  visitorForm.hidden = !crearVisitante;
  knownPersonActions.hidden = crearVisitante;
  (crearVisitante ? document.querySelector("#visitor-name") : actionButton).focus();
}

function mostrarResultado(registro, error = null, crearVisitante = false, pendienteNoGuardado = false, errorLimpieza = false) {
  identityStep.hidden = true;
  personStep.hidden = true;
  resultStep.hidden = false;
  const esIngreso = registro.Tipo_Registro === "Ingreso";
  const icono = document.querySelector("#result-icon");
  icono.className = `result-icon${esIngreso ? "" : " result-icon--exit"}`;
  document.querySelector("#result-kicker").textContent = esIngreso ? "INGRESO COMPLETADO" : "SALIDA COMPLETADA";

  let titulo = esIngreso ? "Ingreso completado" : "Salida completada";
  let detalle = esIngreso
    ? "Tu ingreso quedó registrado correctamente."
    : "Tu salida quedó registrada correctamente.";
  if (error) {
    document.querySelector("#result-kicker").textContent = "REGISTRO NO CONFIRMADO";
    icono.className = "result-icon result-icon--warning";
    titulo = "No se pudo confirmar el registro";
    detalle = presentarErrorUsuario("registro", error);
    if (pendienteNoGuardado) {
      detalle += " No fue posible conservar la operación temporalmente; los datos permanecen en este formulario.";
    }
  } else if (errorLimpieza) {
    detalle += " No se pudo limpiar una copia temporal local; solicita asistencia antes de volver a registrar este movimiento.";
  }
  document.querySelector("#result-title").textContent = titulo;
  document.querySelector("#result-description").textContent = detalle;
  Swal.fire({
    icon: error ? "error" : "success",
    title: titulo,
    text: detalle,
    confirmButtonText: error ? "Volver al formulario" : "Finalizar",
    buttonsStyling: false,
    customClass: {
      popup: "morato-alert",
      title: "morato-alert__title",
      htmlContainer: "morato-alert__text",
      confirmButton: "morato-alert__confirm"
    },
    allowOutsideClick: false,
    allowEscapeKey: false,
    heightAuto: false
  }).then(() => {
    if (error) {
      restaurarFormularioTrasError(crearVisitante);
    } else {
      finalizar();
    }
  });
}

async function validarEstadoActualParaMovimiento(persona, tipoRegistro, crearVisitante) {
  const respuesta = await consultarPersonaPowerAutomate(persona.Nro_Documento);
  if (crearVisitante) {
    if (respuesta.encontrado) {
      mostrarError("Este documento ya aparece registrado. Vuelve a consultar la identificación antes de continuar.");
      return null;
    }
    return persona;
  }

  if (!respuesta.encontrado) {
    mostrarError("No pudimos confirmar el estado actual. Vuelve a consultar la identificación antes de registrar.");
    return null;
  }
  if (respuesta.persona.Estado.toLocaleLowerCase("es-CO") !== "activo") {
    mostrarError("No es posible continuar con este documento. Comunícate con el área de IT Colombia para recibir asistencia.");
    return null;
  }
  if (respuesta.tipoUsuario !== persona.Tipo_Usuario) {
    mostrarError("La información de identificación cambió. Vuelve a consultar el documento antes de registrar.");
    return null;
  }

  const personaActualizada = {
    ...respuesta.persona,
    Tipo_Usuario: respuesta.tipoUsuario,
    ultimoTipoRegistro: respuesta.ultimoMovimiento?.Tipo_Registro ?? ""
  };
  const validacionMovimiento = validarMovimiento(
    [],
    personaActualizada.Nro_Documento,
    tipoRegistro,
    personaActualizada.ultimoTipoRegistro
  );
  if (!validacionMovimiento.valido) {
    mostrarError(validacionMovimiento.mensaje);
    return null;
  }
  return personaActualizada;
}

async function ejecutarRegistroMovimiento(persona, tipoRegistro, equipoTecnologico, crearVisitante, botones) {
  const personaActualizada = await validarEstadoActualParaMovimiento(persona, tipoRegistro, crearVisitante);
  if (!personaActualizada) return;
  const registro = construirMovimiento(personaActualizada, tipoRegistro, equipoTecnologico, crearVisitante);
  for (const boton of botones) boton.textContent = "Registrando…";
  let errorEnvio = null;
  let pendienteNoGuardado = false;
  try {
    await enviarMovimientoPowerAutomate(registro);
    try {
      eliminarRegistroPendiente(registro.local_id);
    } catch (error) {
      registrarDiagnosticoSeguro("limpieza_pendiente", error);
      mostrarResultado(registro, null, crearVisitante, false, true);
      return;
    }
  } catch (error) {
    errorEnvio = error;
    registrarDiagnosticoSeguro("registro", error, crearVisitante
      ? "CREAR_VISITANTE_Y_REGISTRAR_INGRESO"
      : personaActualizada.Tipo_Usuario === "Interno"
        ? "REGISTRAR_MOVIMIENTO_INTERNO"
        : "REGISTRAR_MOVIMIENTO_VISITANTE");
    try {
      guardarRegistroPendiente(registro);
    } catch (errorAlmacenamiento) {
      registrarDiagnosticoSeguro("guardar_pendiente", errorAlmacenamiento);
      pendienteNoGuardado = true;
    }
  }
  mostrarResultado(registro, errorEnvio, crearVisitante, pendienteNoGuardado);
}

async function registrarMovimiento(persona, tipoRegistro, equipoTecnologico, crearVisitante = false) {
  if (operacionEnCurso) return;
  operacionEnCurso = true;
  ocultarError();
  const botones = [actionButton, visitorEntryButton];
  const contenidoBotones = botones.map((boton) => boton.innerHTML);
  for (const boton of botones) {
    boton.disabled = true;
    boton.classList.add("is-loading");
    boton.setAttribute("aria-busy", "true");
    boton.textContent = "Verificando…";
  }
  try {
    const ejecutar = async () => {
      await ejecutarRegistroMovimiento(persona, tipoRegistro, equipoTecnologico, crearVisitante, botones);
    };
    if (navigator.locks?.request) {
      await navigator.locks.request("morato-movement-registration", { ifAvailable: true }, async (lock) => {
        if (!lock) {
          mostrarError("Hay otra operación en curso en este navegador. Espera y vuelve a consultar el documento.");
          return;
        }
        await ejecutar();
      });
    } else {
      await ejecutar();
    }
  } catch (error) {
    registrarDiagnosticoSeguro("verificacion_estado");
    mostrarError(presentarErrorUsuario("consulta", error));
  } finally {
    operacionEnCurso = false;
    botones.forEach((boton, indice) => {
      boton.disabled = false;
      boton.classList.remove("is-loading");
      boton.removeAttribute("aria-busy");
      boton.innerHTML = contenidoBotones[indice];
    });
  }
}

function prepararRegistroVisitante() {
  const datosVisitante = normalizarDatosVisitante(leerDatosFormularioVisitante());
  document.querySelector("#visitor-name").value = datosVisitante.Nombre_Completo;
  document.querySelector("#visitor-email").value = datosVisitante.Email;
  rhChoices.setChoiceByValue(datosVisitante.RH);
  document.querySelector("#visitor-eps").value = datosVisitante.EPS;
  document.querySelector("#visitor-arl").value = datosVisitante.ARL;
  document.querySelector("#visitor-contact").value = datosVisitante.Persona_Contacto;
  document.querySelector("#visitor-phone").value = datosVisitante.Telefono_Contacto;
  for (const campo of visitorForm.querySelectorAll("input, select")) actualizarErrorCampo(campo);
  const persona = normalizarPersonaSharePoint({
    Nro_Documento: personaActual.Nro_Documento,
    ...datosVisitante,
    Estado: "Activo"
  });
  const validacion = validarDatosVisitante(persona);
  if (!validacion.valida) {
    const camposPorNombre = {
      Nombre_Completo: "visitor-name",
      Email: "visitor-email",
      RH: "visitor-rh",
      EPS: "visitor-eps",
      ARL: "visitor-arl",
      Persona_Contacto: "visitor-contact",
      Telefono_Contacto: "visitor-phone"
    };
    for (const [nombre, texto] of Object.entries(validacion.errores)) {
      actualizarErrorCampo(document.querySelector(`#${camposPorNombre[nombre]}`), texto);
    }
    const primerCampo = Object.keys(validacion.errores)[0];
    if (primerCampo === "RH") {
      rhChoices.containerOuter.element.focus();
    } else {
      document.querySelector(`#${camposPorNombre[primerCampo]}`)?.focus();
    }
    return null;
  }
  const email = document.querySelector("#visitor-email");
  if (!email.validity.valid) {
    actualizarErrorCampo(email, "Revisa el formato del correo electrónico.");
    email.focus();
    return null;
  }
  const equipoTecnologico = leerElementosIngresantes(visitorElementsCheckbox, visitorEquipment);
  if (equipoTecnologico === null) return null;
  for (const campo of visitorForm.querySelectorAll("input, select")) actualizarErrorCampo(campo);
  persona.Tipo_Usuario = "Visitante";
  return { persona, equipoTecnologico };
}

async function crearVisitanteYRegistrar(evento) {
  evento.preventDefault();
  if (registroVisitanteEnCurso) return;
  registroVisitanteEnCurso = true;
  ocultarError();
  try {
    let registro = prepararRegistroVisitante();
    if (!registro) return;

    while (true) {
      const huellaAntesDeAceptar = obtenerHuellaFormularioVisitante();
      const resultadoConsentimiento = await mostrarAvisoPrivacidad();
      if (!resultadoConsentimiento.isConfirmed) return;

      if (huellaAntesDeAceptar !== obtenerHuellaFormularioVisitante()) {
        registro = prepararRegistroVisitante();
        if (!registro) return;
        continue;
      }

      await registrarMovimiento(registro.persona, "Ingreso", registro.equipoTecnologico, true);
      return;
    }
  } finally {
    registroVisitanteEnCurso = false;
  }
}

function finalizar() {
  identityForm.reset();
  visitorForm.reset();
  rhChoices.setChoiceByValue("");
  visitorElementsCheckbox.checked = false;
  actualizarElementosVisitante();
  knownElementsCheckbox.checked = false;
  actualizarElementosPersonaConocida();
  personaActual = null;
  identityStep.hidden = false;
  personStep.hidden = true;
  resultStep.hidden = true;
  visitorForm.hidden = true;
  knownPersonActions.hidden = true;
  ocultarError();
  cedulaInput.focus();
}

async function mostrarResumenPendientesAlInicio() {
  let resumen;
  try {
    resumen = obtenerResumenRegistrosPendientes();
  } catch (error) {
    registrarDiagnosticoSeguro("lectura_pendientes", error);
    await Swal.fire({
      icon: "warning",
      title: "No pudimos revisar los registros temporales",
      text: "No se eliminó información. Comunícate con recepción antes de volver a enviar una operación pendiente.",
      confirmButtonText: "Entendido",
      buttonsStyling: false,
      customClass: {
        popup: "morato-alert",
        title: "morato-alert__title",
        htmlContainer: "morato-alert__text",
        confirmButton: "morato-alert__confirm"
      }
    });
    return;
  }

  if (resumen.activeCount === 0 && resumen.expiredCount === 0) return;
  const textoPendientes = resumen.activeCount > 0
    ? `${resumen.activeCount} operación(es) aún no confirmada(s). No se reenviarán automáticamente; verifica su estado con recepción antes de iniciar otro registro.`
    : "";
  const textoVencidos = resumen.expiredCount > 0
    ? `${resumen.expiredCount} copia(s) local(es) vencida(s). Su resultado pudo haberse guardado en el servidor; confirma el estado antes de eliminar estas copias.`
    : "";
  const textoLegados = resumen.legacyCount > 0
    ? `${resumen.legacyCount} registro(s) provienen de una versión anterior. Los que no tengan fecha válida se conservarán porque no es posible determinar su vencimiento.`
    : "";

  if (resumen.expiredCount === 0) {
    await Swal.fire({
      icon: "info",
      title: "Hay operaciones pendientes de conciliación",
      text: [textoPendientes, textoLegados].filter(Boolean).join(" "),
      confirmButtonText: "Entendido",
      buttonsStyling: false,
      customClass: {
        popup: "morato-alert",
        title: "morato-alert__title",
        htmlContainer: "morato-alert__text",
        confirmButton: "morato-alert__confirm"
      }
    });
    return;
  }

  const resultado = await Swal.fire({
    icon: "warning",
    title: "Revisa las copias temporales pendientes",
    text: [textoPendientes, textoVencidos, textoLegados].filter(Boolean).join(" "),
    showCancelButton: true,
    confirmButtonText: "Eliminar solo las copias vencidas",
    cancelButtonText: "Conservar y revisar",
    reverseButtons: true,
    buttonsStyling: false,
    allowOutsideClick: false,
    customClass: {
      popup: "morato-alert",
      title: "morato-alert__title",
      htmlContainer: "morato-alert__text",
      confirmButton: "morato-alert__confirm",
      cancelButton: "privacy-consent__cancel"
    }
  });
  if (!resultado.isConfirmed) return;

  try {
    const eliminados = eliminarRegistrosPendientesVencidos();
    await Swal.fire({
      icon: "info",
      title: "Copias vencidas eliminadas",
      text: `Se eliminaron ${eliminados} copia(s) temporal(es). Los registros activos o sin fecha válida se conservaron.`,
      confirmButtonText: "Entendido",
      buttonsStyling: false,
      customClass: {
        popup: "morato-alert",
        title: "morato-alert__title",
        htmlContainer: "morato-alert__text",
        confirmButton: "morato-alert__confirm"
      }
    });
  } catch (error) {
    registrarDiagnosticoSeguro("limpieza_pendientes_vencidos", error);
    await Swal.fire({
      icon: "error",
      title: "No se pudieron eliminar las copias vencidas",
      text: "La información se conservó. Comunícate con soporte para revisar el almacenamiento del navegador.",
      confirmButtonText: "Entendido",
      buttonsStyling: false,
      customClass: {
        popup: "morato-alert",
        title: "morato-alert__title",
        htmlContainer: "morato-alert__text",
        confirmButton: "morato-alert__confirm"
      }
    });
  }
}

async function revisarHistorialObsoletoAlInicio() {
  let resumen;
  try {
    resumen = obtenerResumenHistorialObsoleto();
  } catch (error) {
    registrarDiagnosticoSeguro("lectura_historial_obsoleto", error);
    await Swal.fire({
      icon: "warning",
      title: "No pudimos revisar datos locales anteriores",
      text: "No se eliminó información. Revisa el almacenamiento del navegador con soporte.",
      confirmButtonText: "Entendido",
      buttonsStyling: false,
      customClass: {
        popup: "morato-alert",
        title: "morato-alert__title",
        htmlContainer: "morato-alert__text",
        confirmButton: "morato-alert__confirm"
      }
    });
    return;
  }

  if (resumen.invalid) {
    await Swal.fire({
      icon: "warning",
      title: "Hay datos locales anteriores que no se pueden revisar",
      text: "No se modificaron ni eliminaron. Si deseas borrarlos, solicita ayuda a soporte para revisar el almacenamiento del navegador.",
      confirmButtonText: "Entendido",
      buttonsStyling: false,
      customClass: {
        popup: "morato-alert",
        title: "morato-alert__title",
        htmlContainer: "morato-alert__text",
        confirmButton: "morato-alert__confirm"
      }
    });
    return;
  }
  if (resumen.count === 0) return;

  const resultado = await Swal.fire({
    icon: "warning",
    title: "Hay historial local de una versión anterior",
    text: `Encontramos ${resumen.count} registro(s) que pueden contener datos personales. Este historial ya no se usa para consultar ni decidir movimientos. ¿Quieres eliminarlo de este navegador?`,
    showCancelButton: true,
    confirmButtonText: "Eliminar historial anterior",
    cancelButtonText: "Conservar por ahora",
    reverseButtons: true,
    buttonsStyling: false,
    allowOutsideClick: false,
    customClass: {
      popup: "morato-alert",
      title: "morato-alert__title",
      htmlContainer: "morato-alert__text",
      confirmButton: "morato-alert__confirm",
      cancelButton: "privacy-consent__cancel"
    }
  });
  if (!resultado.isConfirmed) return;

  try {
    eliminarHistorialObsoleto();
  } catch (error) {
    registrarDiagnosticoSeguro("limpieza_historial_obsoleto", error);
    await Swal.fire({
      icon: "error",
      title: "No se pudo eliminar el historial anterior",
      text: "La información se conservó. Comunícate con soporte para revisar el almacenamiento del navegador.",
      confirmButtonText: "Entendido",
      buttonsStyling: false,
      customClass: {
        popup: "morato-alert",
        title: "morato-alert__title",
        htmlContainer: "morato-alert__text",
        confirmButton: "morato-alert__confirm"
      }
    });
  }
}

async function revisarPendientesAlInicio() {
  await mostrarResumenPendientesAlInicio();
  await revisarHistorialObsoletoAlInicio();
}

identityForm.addEventListener("submit", identificarPersona);
visitorForm.addEventListener("submit", crearVisitanteYRegistrar);
configurarValidacionCampos();
actionButton.addEventListener("click", () => {
  if (personaActual) {
    const movimiento = personaActual.tipoRegistro;
    const equipoTecnologico = movimiento === "Ingreso"
      ? leerElementosIngresantes(knownElementsCheckbox, knownEquipment)
      : "No ingresa con elemento";
    if (equipoTecnologico === null) return;
    registrarMovimiento(
      personaActual,
      movimiento,
      equipoTecnologico
    );
  }
});
document.querySelector("#change-person").addEventListener("click", finalizar);
document.querySelector("#finish-button").addEventListener("click", finalizar);

actualizarReloj();
window.setInterval(actualizarReloj, 30_000);
void revisarPendientesAlInicio();
