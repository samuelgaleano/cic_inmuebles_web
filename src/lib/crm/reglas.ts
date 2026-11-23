import type { Property } from "@/lib/domain";
import { normalizarTelefono } from "@/lib/utils/telefono";
import type { Cierre, ClaseSeguimiento, ContactoInput, Origen } from "./tipos";

/** Reglas puras del CRM (sin base de datos), para poder probarlas. */

/** Comisión por porcentaje, redondeada al peso. Mismo cálculo que la columna generada de la base. */
export function comisionValor(precio: number | null | undefined, pct: number): number | undefined {
  if (precio === null || precio === undefined || !Number.isFinite(precio)) return undefined;
  return Math.round((precio * pct) / 100);
}

/**
 * Precios como los escribe la gente: "450.000.000", "$ 450,000,000", "450000000".
 * Vacío = sin dato (undefined). Algo que no es un número, o negativo, = null (inválido).
 */
export function leerPrecio(crudo: string | null | undefined): number | undefined | null {
  const t = (crudo ?? "").trim();
  if (!t) return undefined;
  if (!/^[\d\s.,$]+$/.test(t)) return null;
  const n = Number(t.replace(/[\s.,$]/g, ""));
  return Number.isSafeInteger(n) ? n : null;
}

/** Porcentaje 0 a 100 con coma o punto decimal ("3", "2,5"). Vacío = el predeterminado. */
export function leerPorcentaje(crudo: string | null | undefined, predeterminado = 3): number | null {
  const t = (crudo ?? "").trim().replace(",", ".");
  if (!t) return predeterminado;
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return n >= 0 && n <= 100 ? Math.round(n * 100) / 100 : null;
}

export type ResultadoContacto = { ok: true; valor: ContactoInput } | { ok: false; errores: Record<string, string> };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Valida y normaliza los datos de un contacto. El teléfono se guarda legible y en formato internacional. */
export function validarContacto(datos: {
  nombre?: string;
  telefono?: string;
  email?: string;
  ciudad?: string;
  notas?: string;
  origen?: Origen;
}): ResultadoContacto {
  const errores: Record<string, string> = {};
  const nombre = (datos.nombre ?? "").trim().replace(/\s+/g, " ");
  if (nombre.length < 2) errores.nombre = "Escribe el nombre.";
  if (nombre.length > 120) errores.nombre = "El nombre es demasiado largo.";

  let telefono: string | undefined;
  let telefonoE164: string | undefined;
  const crudo = (datos.telefono ?? "").trim();
  if (crudo) {
    const n = normalizarTelefono(crudo);
    if (!n) errores.telefono = "Revisa el teléfono: no parece un número válido.";
    else {
      telefono = n.legible;
      telefonoE164 = n.e164;
    }
  }

  const email = (datos.email ?? "").trim().toLowerCase();
  if (email && (!EMAIL.test(email) || email.length > 160)) errores.email = "Revisa el correo.";

  const limpiar = (t: string | undefined, max: number) => (t ?? "").trim().slice(0, max) || undefined;
  if (Object.keys(errores).length) return { ok: false, errores };
  return {
    ok: true,
    valor: {
      nombre,
      ...(telefono ? { telefono } : {}),
      ...(telefonoE164 ? { telefonoE164 } : {}),
      ...(email ? { email } : {}),
      ...(limpiar(datos.ciudad, 80) ? { ciudad: limpiar(datos.ciudad, 80) } : {}),
      ...(limpiar(datos.notas, 2000) ? { notas: limpiar(datos.notas, 2000) } : {}),
      origen: datos.origen ?? "manual",
    },
  };
}

/** Sin tildes, en minúscula y sin signos: para comparar ubicaciones escritas a mano. */
export function sinTildes(t: string): string {
  return t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface Sugerencia {
  property: Property;
  /** Por qué se sugiere, para mostrarlo. */
  motivo: string;
  puntos: number;
}

const PALABRAS_VACIAS = new Set(["de", "del", "la", "el", "los", "las", "en", "y", "cerca", "zona", "sector", "barrio"]);

/**
 * Inmuebles disponibles que encajan con lo que busca un comprador. Determinista y explicable:
 * dentro del presupuesto (con 10 % de margen para negociar) y, si dio ubicación, que alguna de
 * sus palabras aparezca en ciudad, sector, conjunto o título. Quedan fuera los ya propuestos.
 */
export function sugerirInmuebles(
  busqueda: { ubicacion?: string; precioMax?: number },
  inmuebles: Property[],
  yaPropuestos: string[] = [],
  limite = 5,
): Sugerencia[] {
  const excluidos = new Set(yaPropuestos);
  const palabras = sinTildes(busqueda.ubicacion ?? "")
    .split(" ")
    .filter((p) => p.length > 2 && !PALABRAS_VACIAS.has(p));

  const resultado: Sugerencia[] = [];
  for (const p of inmuebles) {
    if (p.estado !== "disponible" || excluidos.has(p.id)) continue;
    let puntos = 0;
    const motivos: string[] = [];

    if (busqueda.precioMax !== undefined) {
      if (p.precio > busqueda.precioMax * 1.1) continue;
      puntos += p.precio <= busqueda.precioMax ? 2 : 1;
      motivos.push(p.precio <= busqueda.precioMax ? "dentro del presupuesto" : "hasta 10 % sobre el presupuesto");
    }
    if (palabras.length) {
      const donde = sinTildes([p.ubicacion.ciudad, p.ubicacion.sector, p.ubicacion.conjunto, p.titulo].filter(Boolean).join(" "));
      const aciertos = palabras.filter((w) => donde.includes(w));
      if (!aciertos.length) continue;
      puntos += 2 + aciertos.length;
      motivos.push(`zona: ${aciertos.join(", ")}`);
    }
    if (puntos === 0 && (busqueda.precioMax !== undefined || palabras.length)) continue;
    if (puntos === 0) motivos.push("disponible");
    resultado.push({ property: p, motivo: motivos.join(" · "), puntos });
  }
  return resultado.sort((a, b) => b.puntos - a.puntos || b.property.precio - a.property.precio).slice(0, limite);
}

// ---------------------------------------------------------------- Próximo contacto

/** Bogotá es UTC-5 todo el año (sin horario de verano), igual que en src/lib/utils/hora-bogota.ts. */
const DESFASE_BOGOTA_MS = 5 * 60 * 60 * 1000;
const DIA_MS = 24 * 60 * 60 * 1000;

/** Día calendario de Bogotá ("2026-11-23") de un instante. */
export function diaBogota(instante: Date | string): string {
  const t = typeof instante === "string" ? new Date(instante).getTime() : instante.getTime();
  return new Date(t - DESFASE_BOGOTA_MS).toISOString().slice(0, 10);
}

/** Último milisegundo del día de hoy en Bogotá, en ISO UTC: el tope para listar "lo de hoy y lo vencido". */
export function finDelDiaBogota(ahora: Date): string {
  const [a, m, d] = diaBogota(ahora).split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + 1) + DESFASE_BOGOTA_MS - 1).toISOString();
}

/** El día `dias` después de hoy (calendario de Bogotá) a las 9:00 de Bogotá, en ISO UTC. */
export function fechaDeSeguimiento(dias: number, ahora: Date): string {
  const [a, m, d] = diaBogota(ahora).split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + Math.trunc(dias), 9) + DESFASE_BOGOTA_MS).toISOString();
}

/** Diferencia en días calendario de Bogotá: positiva si `at` cae antes de hoy. */
export function diasDeAtraso(at: string, ahora: Date): number {
  return Math.round((Date.parse(diaBogota(ahora)) - Date.parse(diaBogota(at))) / DIA_MS);
}

/** Si el próximo contacto ya pasó (día anterior), es hoy o es más adelante, por día calendario de Bogotá. */
export function clasificarSeguimiento(at: string, ahora: Date): ClaseSeguimiento {
  const atraso = diasDeAtraso(at, ahora);
  return atraso > 0 ? "vencido" : atraso === 0 ? "hoy" : "futuro";
}

/** ISO UTC → valor de un `<input type="datetime-local">` en hora de Bogotá ("2026-11-24T09:00"). */
export function aHoraLocalBogota(iso: string): string {
  return new Date(new Date(iso).getTime() - DESFASE_BOGOTA_MS).toISOString().slice(0, 16);
}

// ---------------------------------------------------------------- Cierres

/** "2026-11-23" con fecha real (sin 2026-02-30). */
export function leerDia(crudo: string | null | undefined): string | null {
  const t = (crudo ?? "").trim();
  const m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const f = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return f.toISOString().slice(0, 10) === t ? t : null;
}

export type ResultadoCierre =
  | { ok: true; valor: { precioVenta: number; fechaCierre: string; comisionPct?: number; comisionPactada?: number } }
  | { ok: false; error: string };

/**
 * Valida el registro de una venta: precio mayor que cero, fecha real y no más de un día en el futuro
 * (margen por si se registra de noche con la hora de otro lado). La comisión pactada, si no se escribe,
 * es precio × porcentaje / 100 redondeada al peso. Porcentaje vacío = sin porcentaje.
 */
export function validarCierre(
  datos: { precio?: string; fecha?: string; pct?: string; pactada?: string },
  ahora: Date,
): ResultadoCierre {
  const precio = leerPrecio(datos.precio);
  if (precio === null || precio === undefined || precio <= 0) return { ok: false, error: "Escribe el precio de venta (solo números, mayor que cero)." };

  const fecha = leerDia(datos.fecha);
  if (!fecha) return { ok: false, error: "Revisa la fecha de la venta." };
  const manana = diaBogota(new Date(ahora.getTime() + DIA_MS));
  if (fecha > manana) return { ok: false, error: "La fecha de la venta no puede estar en el futuro." };
  if (fecha < "2000-01-01") return { ok: false, error: "Revisa la fecha de la venta." };

  let pct: number | undefined;
  if ((datos.pct ?? "").trim()) {
    const p = leerPorcentaje(datos.pct);
    if (p === null) return { ok: false, error: "Revisa el porcentaje de comisión: debe estar entre 0 y 100." };
    pct = p;
  }

  const pactadaEscrita = leerPrecio(datos.pactada);
  if (pactadaEscrita === null) return { ok: false, error: "Revisa la comisión pactada: usa solo números." };
  const pactada = pactadaEscrita ?? (pct !== undefined ? comisionValor(precio, pct) : undefined);

  return {
    ok: true,
    valor: {
      precioVenta: precio,
      fechaCierre: fecha,
      ...(pct !== undefined ? { comisionPct: pct } : {}),
      ...(pactada !== undefined ? { comisionPactada: pactada } : {}),
    },
  };
}

export interface MesDeCierres {
  /** "2026-11" */
  mes: string;
  cantidad: number;
  valorVendido: number;
  comisionPactada: number;
  comisionCobrada: number;
}

/** Ventas cerradas por mes (según la fecha de cierre), de los últimos `meses` incluido el actual, del más reciente al más viejo. */
export function cierresPorMes(cierres: Pick<Cierre, "fechaCierre" | "precioVenta" | "comisionPactada" | "comisionCobrada">[], ahora: Date, meses = 6): MesDeCierres[] {
  const [a, m] = diaBogota(ahora).split("-").map(Number);
  const filas: MesDeCierres[] = [];
  for (let i = 0; i < meses; i++) {
    const f = new Date(Date.UTC(a, m - 1 - i, 1));
    filas.push({ mes: f.toISOString().slice(0, 7), cantidad: 0, valorVendido: 0, comisionPactada: 0, comisionCobrada: 0 });
  }
  const porMes = new Map(filas.map((f) => [f.mes, f]));
  for (const c of cierres) {
    const f = porMes.get(c.fechaCierre.slice(0, 7));
    if (!f) continue;
    f.cantidad += 1;
    f.valorVendido += c.precioVenta;
    f.comisionPactada += c.comisionPactada ?? 0;
    f.comisionCobrada += c.comisionCobrada ?? 0;
  }
  return filas;
}
