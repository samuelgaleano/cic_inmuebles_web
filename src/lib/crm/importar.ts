import { leerCsv } from "@/lib/export/csv";
import { leerPorcentaje, leerPrecio, sinTildes, validarContacto } from "./reglas";
import type { CrmStore } from "./store";
import type { EstatusPago, Multimedia, TipoComprador } from "./tipos";

/**
 * Carga de vendedores y compradores desde una hoja (CSV o texto copiado de Excel / Google Sheets), con las
 * mismas columnas de la hoja «CRM CATALOGO BD». Idempotente: volver a cargar el mismo archivo no duplica nada.
 */

export type TipoImportacion = "vendedores" | "compradores";

export interface ResultadoImportacion {
  simulacion: boolean;
  /** Filas con datos que se leyeron (sin contar las vacías). */
  filas: number;
  contactosNuevos: number;
  contactosExistentes: number;
  /** Vendedores o compradores nuevos. */
  creados: number;
  /** Ya estaban cargados: no se repiten. */
  yaExistian: number;
  /** Inmuebles propuestos a compradores. */
  propuestas: number;
  errores: { fila: number; motivo: string }[];
  /** Error que impide leer el archivo (columnas que faltan, demasiadas filas…). */
  fatal?: string;
}

export interface InmuebleRef {
  id: string;
  codigo: string;
  slug: string;
}

const MAX_FILAS = 2000;
const MAX_ERRORES = 50;

const vacio = (): ResultadoImportacion => ({ simulacion: false, filas: 0, contactosNuevos: 0, contactosExistentes: 0, creados: 0, yaExistian: 0, propuestas: 0, errores: [] });

function indiceDe(encabezados: string[], ...candidatos: string[]): number {
  const limpios = encabezados.map((h) => sinTildes(h));
  for (const c of candidatos) {
    const i = limpios.findIndex((h) => h === c);
    if (i >= 0) return i;
  }
  for (const c of candidatos) {
    const i = limpios.findIndex((h) => h.startsWith(c));
    if (i >= 0) return i;
  }
  return -1;
}

const celda = (fila: string[], i: number): string => (i >= 0 ? (fila[i] ?? "").trim() : "");
const esSi = (v: string) => ["si", "s", "x", "1", "true", "yes"].includes(sinTildes(v));

function estatusDe(v: string): EstatusPago {
  const t = sinTildes(v);
  if (t.includes("parcial")) return "paga_parcial";
  if (t.includes("completo")) return "paga_completo";
  if (t.startsWith("no")) return "no_paga";
  return "pendiente";
}

function multimediaDe(v: string): Multimedia {
  const t = sinTildes(v);
  if (esSi(v)) return "listo";
  if (t === "in" || t.includes("curso") || t.includes("proceso")) return "en_curso";
  return "por_coordinar";
}

function tipoCompradorDe(v: string): TipoComprador {
  const t = sinTildes(v);
  if (t.includes("inmobiliaria")) return "inmobiliaria";
  if (t.includes("indep")) return "independiente";
  return "comprador";
}

function buscarInmueble(codigo: string, inmuebles: InmuebleRef[]): InmuebleRef | undefined {
  const c = codigo.trim().toLowerCase().replace(/^#/, "");
  return c ? inmuebles.find((p) => p.codigo.toLowerCase() === c || p.slug.toLowerCase() === c) : undefined;
}

export async function importarHoja(
  tipo: TipoImportacion,
  texto: string,
  deps: { crm: CrmStore; inmuebles: InmuebleRef[] },
  opts: { simular: boolean },
): Promise<ResultadoImportacion> {
  const r = vacio();
  r.simulacion = opts.simular;

  const filas = leerCsv(texto);
  if (filas.length < 2) return { ...r, fatal: "No encontré filas: pega o sube la hoja con su fila de títulos arriba." };
  if (filas.length - 1 > MAX_FILAS) return { ...r, fatal: `Son demasiadas filas (máximo ${MAX_FILAS} por carga). Divide la hoja.` };

  const [enc, ...datos] = filas;
  const iNombre = indiceDe(enc, "nombre");
  const iTel = indiceDe(enc, "celular", "telefono", "tel");
  const iUbic = indiceDe(enc, "ubicacion");
  const iPrecio = indiceDe(enc, "precio", "presupuesto");
  if (iNombre < 0) return { ...r, fatal: "Falta la columna NOMBRE en la fila de títulos." };

  // Vendedores
  const iPct = enc.findIndex((h) => h.trim() === "%" || sinTildes(h) === "porcentaje");
  const iEstatus = indiceDe(enc, "estatus", "estado de pago", "pago");
  const iAprob = indiceDe(enc, "aprobacion", "aprobada");
  const iInmueble = indiceDe(enc, "id inmueble", "codigo");
  const iMedia = indiceDe(enc, "coordinacion");
  // Compradores
  const iTipo = indiceDe(enc, "tipo");
  const iEspec = indiceDe(enc, "especificacion");
  const iPotencial = indiceDe(enc, "potencial");
  const iNumerales = enc.map((h, i) => (sinTildes(h).startsWith("numeral inmueble") ? i : -1)).filter((i) => i >= 0);

  const conocidos = new Map<string, string>(); // teléfono internacional -> contactoId
  const sinTelefono = new Map<string, string>(); // nombre sin tildes -> contactoId (solo los que no tienen teléfono)
  for (const c of await deps.crm.listarContactos({ incluirArchivados: true })) {
    if (c.telefonoE164) conocidos.set(c.telefonoE164, c.id);
    else sinTelefono.set(sinTildes(c.nombre), c.id);
  }
  const nuevosEnSimulacion = new Set<string>();

  const error = (fila: number, motivo: string) => {
    if (r.errores.length < MAX_ERRORES) r.errores.push({ fila, motivo });
  };

  for (let n = 0; n < datos.length; n++) {
    const fila = datos[n];
    const numero = n + 2; // número de fila en la hoja (la 1 son los títulos)
    const nombre = celda(fila, iNombre);
    const telefono = celda(fila, iTel);
    const ubicacion = celda(fila, iUbic);
    const precioTexto = celda(fila, iPrecio);

    // Una fila sin nombre, teléfono, ubicación ni precio es relleno de la plantilla (p. ej. solo «PAGA COMPLETO»).
    if (!nombre && !telefono && !ubicacion && !precioTexto) continue;
    r.filas += 1;

    if (!nombre) {
      error(numero, "Falta el nombre.");
      continue;
    }
    const precio = leerPrecio(precioTexto);
    if (precio === null) {
      error(numero, `El precio «${precioTexto}» no es un número.`);
      continue;
    }
    const v = validarContacto({ nombre, telefono, ciudad: undefined, origen: "hoja" });
    if (!v.ok) {
      error(numero, Object.values(v.errores)[0]);
      continue;
    }

    // Datos propios de cada tipo, validados antes de escribir nada de esta fila.
    let pct = 3;
    let propertyId: string | undefined;
    const propuestas: string[] = [];
    if (tipo === "vendedores") {
      const p = leerPorcentaje(celda(fila, iPct).replace("%", ""));
      if (p === null) {
        error(numero, `El porcentaje «${celda(fila, iPct)}» no es válido (0 a 100).`);
        continue;
      }
      pct = p;
      const codigo = celda(fila, iInmueble);
      if (codigo) {
        const inm = buscarInmueble(codigo, deps.inmuebles);
        if (!inm) {
          error(numero, `No existe el inmueble «${codigo}».`);
          continue;
        }
        propertyId = inm.id;
      }
    } else {
      let faltante = "";
      for (const i of iNumerales) {
        const codigo = celda(fila, i);
        if (!codigo) continue;
        const inm = buscarInmueble(codigo, deps.inmuebles);
        if (!inm) faltante = codigo;
        else if (!propuestas.includes(inm.id)) propuestas.push(inm.id);
      }
      if (faltante) {
        error(numero, `No existe el inmueble «${faltante}».`);
        continue;
      }
    }

    // Contacto: se reutiliza por teléfono; sin teléfono, por nombre exacto entre los que tampoco lo tienen.
    const e164 = v.valor.telefonoE164;
    const claveNombre = sinTildes(v.valor.nombre);
    let contactoId = e164 ? conocidos.get(e164) : sinTelefono.get(claveNombre);
    if (contactoId) r.contactosExistentes += 1;
    else if (opts.simular) {
      const clave = e164 ?? `nombre:${claveNombre}`;
      if (!nuevosEnSimulacion.has(clave)) r.contactosNuevos += 1;
      else r.contactosExistentes += 1;
      nuevosEnSimulacion.add(clave);
    } else {
      const creado = await deps.crm.crearContacto(v.valor);
      contactoId = creado.contacto.id;
      if (e164) conocidos.set(e164, contactoId);
      else sinTelefono.set(claveNombre, contactoId);
      if (creado.creado) r.contactosNuevos += 1;
      else r.contactosExistentes += 1;
    }

    if (opts.simular && !contactoId) {
      // Un contacto nuevo no tiene nada cargado todavía: la fila se crearía.
      r.creados += 1;
      r.propuestas += propuestas.length;
      continue;
    }
    const id = contactoId as string;

    try {
      if (tipo === "vendedores") {
        const previas = await deps.crm.listarCaptaciones(id);
        const repetida = previas.some(
          (c) => c.estado !== "descartada" && ((propertyId && c.propertyId === propertyId) || (!propertyId && (c.ubicacion ?? "") === ubicacion && c.precioEsperado === (precio ?? undefined))),
        );
        if (repetida) {
          r.yaExistian += 1;
          continue;
        }
        if (propertyId && (await deps.crm.listarCaptaciones()).some((c) => c.propertyId === propertyId && c.estado !== "descartada")) {
          error(numero, "Ese inmueble ya tiene un vendedor vigente de otra persona.");
          continue;
        }
        r.creados += 1;
        if (!opts.simular) {
          await deps.crm.crearCaptacion({
            contactoId: id,
            ...(propertyId ? { propertyId } : {}),
            ...(ubicacion ? { ubicacion: ubicacion.slice(0, 160) } : {}),
            ...(precio !== undefined ? { precioEsperado: precio } : {}),
            comisionPct: pct,
            estatusPago: estatusDe(celda(fila, iEstatus)),
            aprobada: esSi(celda(fila, iAprob)),
            multimedia: multimediaDe(celda(fila, iMedia)),
            estado: "nueva",
          });
        }
      } else {
        const previas = await deps.crm.listarBusquedas(id);
        const tipoComprador = tipoCompradorDe(celda(fila, iTipo));
        let busqueda = previas.find((b) => b.estado !== "descartada" && b.tipo === tipoComprador && (b.ubicacion ?? "") === ubicacion && b.precioMax === (precio ?? undefined));
        if (busqueda) r.yaExistian += 1;
        else {
          r.creados += 1;
          if (!opts.simular) {
            busqueda = await deps.crm.crearBusqueda({
              contactoId: id,
              tipo: tipoComprador,
              ...(ubicacion ? { ubicacion: ubicacion.slice(0, 160) } : {}),
              ...(precio !== undefined ? { precioMax: precio } : {}),
              ...(celda(fila, iEspec) ? { especificacion: celda(fila, iEspec).slice(0, 600) } : {}),
              potencial: esSi(celda(fila, iPotencial)),
              estado: "activa",
            });
          }
        }
        const yaPropuestos = busqueda ? new Set((await deps.crm.listarPropuestas([busqueda.id])).map((p) => p.propertyId)) : new Set<string>();
        for (const pid of propuestas) {
          if (yaPropuestos.has(pid)) continue;
          r.propuestas += 1;
          if (!opts.simular && busqueda) await deps.crm.proponer(busqueda.id, pid);
        }
      }
    } catch (err) {
      console.error("[crm/importar]", err instanceof Error ? err.message : err);
      error(numero, "No se pudo guardar esta fila.");
    }
  }
  return r;
}
