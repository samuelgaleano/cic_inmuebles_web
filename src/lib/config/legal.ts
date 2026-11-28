/**
 * Datos legales que viajan con cada autorización de tratamiento de datos (Ley 1581 de 2012).
 *
 * POLITICA_VERSION identifica el texto de /privacidad que la persona aceptó al marcar la casilla.
 * Se guarda junto a la fecha en leads.consentimiento_version y pagos_referencias.consentimiento_version:
 * es la prueba de la autorización que la política promete. Si el texto de la política cambia de fondo,
 * se sube esta versión (las autorizaciones anteriores conservan la suya).
 */
export const POLITICA_VERSION = "2026-09";

/** Texto de la casilla, igual en todos los formularios; le sigue el enlace «política de privacidad» (/privacidad). */
export const TEXTO_AUTORIZACION = "Autorizo el tratamiento de mis datos según la";
export const ENLACE_POLITICA = "política de privacidad";

/** Error cuando la casilla llega sin marcar (lo valida el servidor, no solo el navegador). */
export const ERROR_AUTORIZACION =
  "Necesitamos tu autorización para tratar tus datos: marca la casilla de la política de privacidad.";
