import { getCrmStore } from "@/lib/crm/store";
import {
  ESTADO_BUSQUEDA_LABELS,
  ESTADO_CAPTACION_LABELS,
  ESTADO_PROPUESTA_LABELS,
  ESTATUS_PAGO_LABELS,
  MULTIMEDIA_LABELS,
  ORIGEN_LABELS,
  TIPO_ACTIVIDAD_LABELS,
  TIPO_COMPRADOR_LABELS,
} from "@/lib/crm/tipos";
import { getPlan } from "@/lib/config/plans";
import { getRepository } from "@/lib/data";
import { LEAD_INTENT_LABELS, LEAD_STATUS_LABELS } from "@/lib/domain";
import { propertyToSheetRow, SHEET_HEADER } from "@/lib/integrations/sheets";
import { getServiciosStore } from "@/lib/servicios/store";
import { ETIQUETA_ESTADO } from "@/lib/servicios/vigencia";
import { aCsv, type Celda } from "./csv";

/** Qué se puede descargar desde el panel (todo en el mismo formato que usa el equipo en la hoja). */
export const DATASETS = {
  inmuebles: "Inmuebles",
  contactos: "Contactos",
  vendedores: "Vendedores",
  compradores: "Compradores",
  propuestas: "Inmuebles propuestos",
  seguimiento: "Seguimiento",
  leads: "Leads",
  planes: "Planes de publicación",
} as const;
export type Dataset = keyof typeof DATASETS;

export function esDataset(valor: string): valor is Dataset {
  return Object.prototype.hasOwnProperty.call(DATASETS, valor);
}

/** Hojas de ejemplo con las columnas que entiende la carga del CRM. */
export const PLANTILLAS = {
  "plantilla-vendedores": "Plantilla de vendedores",
  "plantilla-compradores": "Plantilla de compradores",
} as const;
export type Plantilla = keyof typeof PLANTILLAS;

export function esPlantilla(valor: string): valor is Plantilla {
  return Object.prototype.hasOwnProperty.call(PLANTILLAS, valor);
}

export function construirPlantilla(nombre: Plantilla): string {
  if (nombre === "plantilla-vendedores") {
    return aCsv(
      ["TIPO", "NOMBRE", "CELULAR", "UBICACION", "PRECIO", "%", "ESTATUS", "APROBACION", "ID INMUEBLE", "COORDINACION VIDEO O FOTOS"],
      [["VENDEDOR", "Marta Pérez", "300 123 4567", "Cedritos, Bogotá", "450.000.000", "3", "PAGA COMPLETO", "SI", "", "NO"]],
    );
  }
  return aCsv(
    ["TIPO", "NOMBRE", "CELULAR", "UBICACION", "PRECIO", "ESPECIFICACION", "POTENCIAL", "NUMERAL INMUEBLE 1", "NUMERAL INMUEBLE 2", "NUMERAL INMUEBLE 3"],
    [["COMPRADOR", "Luis Gómez", "311 555 2020", "Norte de Bogotá", "450.000.000", "3 alcobas y parqueadero", "SI", "", "", ""]],
  );
}

const fecha = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("es-CO", { timeZone: "America/Bogota", dateStyle: "short", timeStyle: "short" }) : "");

export async function construirCsv(dataset: Dataset): Promise<string> {
  const repo = getRepository();
  const crm = getCrmStore();

  if (dataset === "inmuebles") {
    const props = await repo.properties.list();
    return aCsv(SHEET_HEADER, props.map(propertyToSheetRow));
  }

  if (dataset === "leads") {
    const leads = await repo.leads.list();
    return aCsv(
      ["Fecha", "Tipo", "Nombre", "Teléfono", "Correo", "Intención", "Inmueble", "Ciudad", "Tipo de inmueble", "Mensaje", "Origen", "Estado"],
      leads.map((l): Celda[] => [
        fecha(l.creadoEn),
        l.tipo === "vendedor" ? "Vendedor" : "Comprador",
        l.nombre,
        l.telefono,
        l.email,
        l.intencion ? LEAD_INTENT_LABELS[l.intencion] : "",
        l.propertySlug,
        l.ciudad,
        l.tipoInmueble,
        l.mensaje,
        l.fuente,
        LEAD_STATUS_LABELS[l.estado],
      ]),
    );
  }

  if (dataset === "planes") {
    const servicios = await getServiciosStore().listar();
    return aCsv(
      ["Cliente", "Correo", "Teléfono", "Plan", "Días", "Estado", "Inmueble (slug)", "Inicio", "Vence", "Pagado el", "Referencia"],
      servicios.map((s): Celda[] => [
        s.clienteNombre,
        s.clienteEmail,
        s.clienteTelefono,
        getPlan(s.planId)?.nombre ?? s.planId,
        s.dias,
        ETIQUETA_ESTADO[s.estado],
        s.propertySlug,
        fecha(s.inicioAt),
        fecha(s.venceAt),
        fecha(s.createdAt),
        s.reference,
      ]),
    );
  }

  // Datos del CRM: se cruzan contactos, inmuebles y propuestas para que cada fila se entienda sola.
  const [contactos, captaciones, busquedas, propiedades] = await Promise.all([
    crm.listarContactos({ incluirArchivados: true }),
    crm.listarCaptaciones(),
    crm.listarBusquedas(),
    repo.properties.list(),
  ]);
  const persona = new Map(contactos.map((c) => [c.id, c]));
  const inmueble = new Map(propiedades.map((p) => [p.id, p]));

  if (dataset === "contactos") {
    return aCsv(
      ["Nombre", "Teléfono", "Correo", "Ciudad", "Origen", "Vendedor", "Comprador", "Última actividad", "Archivado", "Notas", "Creado"],
      contactos.map((c): Celda[] => [c.nombre, c.telefono, c.email, c.ciudad, ORIGEN_LABELS[c.origen], c.captaciones, c.busquedas, fecha(c.ultimaActividad), c.archivado, c.notas, fecha(c.creadoEn)]),
    );
  }

  if (dataset === "vendedores") {
    return aCsv(
      ["Nombre", "Teléfono", "Ubicación", "Precio", "Comisión %", "Comisión", "Estatus de pago", "Aprobada", "Código del inmueble", "Fotos y video", "Estado", "Notas"],
      captaciones.map((c): Celda[] => {
        const p = persona.get(c.contactoId);
        return [p?.nombre, p?.telefono, c.ubicacion, c.precioEsperado, c.comisionPct, c.comisionValor, ESTATUS_PAGO_LABELS[c.estatusPago], c.aprobada, c.propertyId ? inmueble.get(c.propertyId)?.codigo : "", MULTIMEDIA_LABELS[c.multimedia], ESTADO_CAPTACION_LABELS[c.estado], c.notas];
      }),
    );
  }

  const propuestas = await crm.listarPropuestas(busquedas.map((b) => b.id));
  if (dataset === "compradores") {
    return aCsv(
      ["Tipo", "Nombre", "Teléfono", "Ubicación", "Presupuesto", "Especificación", "Potencial", "Inmuebles propuestos", "Estado"],
      busquedas.map((b): Celda[] => {
        const p = persona.get(b.contactoId);
        const codigos = propuestas.filter((x) => x.busquedaId === b.id).map((x) => inmueble.get(x.propertyId)?.codigo ?? "");
        return [TIPO_COMPRADOR_LABELS[b.tipo], p?.nombre, p?.telefono, b.ubicacion, b.precioMax, b.especificacion, b.potencial, codigos.join(", "), ESTADO_BUSQUEDA_LABELS[b.estado]];
      }),
    );
  }

  if (dataset === "propuestas") {
    const dueno = new Map(busquedas.map((b) => [b.id, b]));
    return aCsv(
      ["Comprador", "Teléfono", "Código del inmueble", "Título", "Precio", "Estado de la propuesta"],
      propuestas.map((x): Celda[] => {
        const b = dueno.get(x.busquedaId);
        const p = b ? persona.get(b.contactoId) : undefined;
        const i = inmueble.get(x.propertyId);
        return [p?.nombre, p?.telefono, i?.codigo, i?.titulo, i?.precio, ESTADO_PROPUESTA_LABELS[x.estado]];
      }),
    );
  }

  // seguimiento: la línea de tiempo de todas las personas
  const filas: Celda[][] = [];
  for (const c of contactos) {
    for (const a of await crm.listarActividades(c.id)) {
      filas.push([fecha(a.ocurrioEn), c.nombre, c.telefono, TIPO_ACTIVIDAD_LABELS[a.tipo], a.propertyId ? inmueble.get(a.propertyId)?.codigo : "", a.detalle]);
    }
  }
  return aCsv(["Fecha", "Contacto", "Teléfono", "Tipo", "Inmueble", "Detalle"], filas);
}
