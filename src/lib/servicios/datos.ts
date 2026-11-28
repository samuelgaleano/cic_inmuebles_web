import { z } from "zod";
import { getPlan } from "@/lib/config/plans";
import { PROPERTY_TYPE_LABELS, PROPERTY_TYPES } from "@/lib/domain/property";
import { formatPrice } from "@/lib/utils/format";
import { normalizarTelefono } from "@/lib/utils/telefono";
import type { DatosInmueble, ServiciosStore } from "./store";
import { servicioDeTokenDeDatos } from "./token";

/**
 * Formulario posterior al pago (/publica/agente/datos?t=...): el cliente deja los datos del inmueble que
 * quiere publicar. Se llega solo con el enlace firmado del correo de confirmación del pago (HMAC con
 * caducidad, propósito "datos"). La lógica vive aquí, sin Next, para probarla; la acción solo la llama.
 *
 * Ley 1581: el contacto que se pide es el que irá en la ficha pública. Nada de lo que escribe la persona
 * va a los logs (solo el id del servicio) ni a la alerta al equipo (solo plan, tipo, ciudad y precio).
 */

export const CAMPOS_DATOS = ["tipo", "ciudad", "sector", "precio", "descripcion", "contactoNombre", "contactoWhatsapp"] as const;
export type CampoDatos = (typeof CAMPOS_DATOS)[number];

export interface DatosFormState {
  status: "idle" | "success" | "error";
  message?: string;
  errors?: Partial<Record<CampoDatos, string>>;
  /** Lo que la persona escribió, solo en error: React vacía los campos no controlados al terminar la acción. */
  values?: Partial<Record<CampoDatos, string>>;
}

const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v));

export const datosSchema = z.object({
  tipo: z.enum(PROPERTY_TYPES, { message: "Elige el tipo de inmueble" }),
  ciudad: z.string().trim().min(2, "Escribe la ciudad o el municipio").max(80),
  sector: textoOpcional(80),
  // Se acepta como la escribe la gente ("350.000.000", "$ 350 000 000"); se guarda en pesos.
  precio: z
    .string()
    .trim()
    .max(24)
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v === "" || (Number(v) >= 100_000 && Number(v) <= 100_000_000_000), "Escribe el precio en pesos, por ejemplo 350.000.000")
    .transform((v) => (v === "" ? null : Number(v))),
  descripcion: textoOpcional(600),
  contactoNombre: z.string().trim().min(2, "Escribe el nombre que verán los interesados").max(120),
  contactoWhatsapp: z
    .string()
    .trim()
    .max(24)
    .refine((v) => Boolean(normalizarTelefono(v)?.e164), "Escribe un WhatsApp válido, por ejemplo 300 123 4567"),
});

/** Envíos permitidos por servicio: uno por espacio (uno en planes por inmueble) más dos para corregir. */
export function maxEnviosDeDatos(planId: string): number {
  return (getPlan(planId)?.espacios ?? 1) + 2;
}

export interface DatosDeps {
  store: ServiciosStore;
  alertar: (asunto: string, texto: string) => Promise<boolean>;
  ahora: () => Date;
}

const ENLACE_INVALIDO = "Este enlace ya no es válido o venció. Escríbenos por WhatsApp y te ayudamos a publicar tu inmueble.";

function valoresVisibles(raw: Record<string, unknown>): DatosFormState["values"] {
  const values: Partial<Record<CampoDatos, string>> = {};
  for (const k of CAMPOS_DATOS) {
    const v = raw[k];
    if (typeof v === "string" && v !== "") values[k] = v.slice(0, 600);
  }
  return values;
}

/** Recibe un envío del formulario. Nunca lanza: siempre devuelve un estado que la página sabe mostrar. */
export async function recibirDatosDeServicio(raw: Record<string, unknown>, deps: DatosDeps): Promise<DatosFormState> {
  // Honeypot: oculto para las personas. Si llega con algo es un bot: éxito idéntico, sin guardar ni avisar.
  const trampa = raw.website;
  if (typeof trampa === "string" ? trampa.trim() !== "" : trampa !== undefined) {
    return { status: "success", message: "Recibimos los datos de tu inmueble." };
  }

  const servicioId = typeof raw.t === "string" ? servicioDeTokenDeDatos(raw.t, deps.ahora()) : null;
  if (!servicioId) return { status: "error", message: ENLACE_INVALIDO };

  const parsed = datosSchema.safeParse(raw);
  if (!parsed.success) {
    const errors: Partial<Record<CampoDatos, string>> = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path[0];
      if (typeof k === "string" && (CAMPOS_DATOS as readonly string[]).includes(k) && !errors[k as CampoDatos]) errors[k as CampoDatos] = issue.message;
    }
    return { status: "error", message: "Falta corregir un dato. Te lo marcamos en rojo.", errors, values: valoresVisibles(raw) };
  }

  const d: DatosInmueble = parsed.data;
  try {
    const s = await deps.store.obtener(servicioId);
    if (!s || s.estado === "descartado") return { status: "error", message: ENLACE_INVALIDO };
    const previos = (await deps.store.datosDeServicios([s.id])).get(s.id) ?? [];
    if (previos.length >= maxEnviosDeDatos(s.planId)) {
      return { status: "error", message: "Ya recibimos los datos de este plan. Si necesitas cambiar algo, escríbenos por WhatsApp.", values: valoresVisibles(raw) };
    }
    await deps.store.guardarDatos(s.id, d);

    const plan = getPlan(s.planId)?.nombre ?? s.planId;
    // Al equipo: lo justo para saber qué llegó. Nombre y WhatsApp del contacto se ven en el panel.
    await deps
      .alertar(
        `Datos del inmueble recibidos (${plan})`,
        [
          `Plan: ${plan}`,
          `Inmueble: ${PROPERTY_TYPE_LABELS[parsed.data.tipo]} en ${d.ciudad}${d.sector ? ` (${d.sector})` : ""}`,
          ...(d.precio ? [`Precio: ${formatPrice(d.precio)}`] : []),
          `Servicio: ${s.id}`,
          "",
          "Los datos completos y el contacto de la ficha están en /admin/vigencias.",
        ].join("\n"),
      )
      .catch(() => false);

    return {
      status: "success",
      message: getPlan(s.planId)?.espacios
        ? "Recibimos los datos. Si tu paquete tiene más inmuebles, vuelve a abrir el enlace del correo para enviar el siguiente."
        : "Recibimos los datos de tu inmueble. Un asesor te escribe por WhatsApp para las fotos.",
    };
  } catch (err) {
    // Sin datos de la persona en el log: solo el servicio y el error técnico.
    console.error(`[datos] no se pudieron guardar los datos del servicio ${servicioId}:`, err instanceof Error ? err.message : err);
    return { status: "error", message: "No pudimos guardar los datos. Intenta de nuevo en unos minutos o escríbenos por WhatsApp.", values: valoresVisibles(raw) };
  }
}
