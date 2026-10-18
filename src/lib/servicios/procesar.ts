import { getPlan, type Plan } from "@/lib/config/plans";
import type { WompiTransaction } from "@/lib/integrations/wompi";
import { sendPagosAlert } from "@/lib/notifications/payment";
import { sendEmail } from "@/lib/notifications/resend";
import { correoDeAviso, correoPagoRecibido, correoRenovacionPagada, type CorreoSaliente } from "./correos";
import { fijarPublicacionDeFicha } from "./ficha";
import { getServiciosStore, ServiciosNoDisponibleError, type ServiciosStore } from "./store";
import { accionDeHoy, fechaLarga, ventanaDeRenovacion, type Servicio } from "./vigencia";

export interface ServiciosDeps {
  store: ServiciosStore;
  enviarCorreo: (m: CorreoSaliente) => Promise<boolean>;
  /** false si no se pudo despublicar (se reintenta al día siguiente). */
  despublicarFicha: (slug: string) => Promise<boolean>;
  /** false si no se pudo volver a publicar la ficha de una renovación pagada. */
  publicarFicha: (slug: string) => Promise<boolean>;
  alertar: (asunto: string, texto: string) => Promise<boolean>;
  ahora: () => Date;
}

export function defaultServiciosDeps(): ServiciosDeps {
  return {
    store: getServiciosStore(),
    enviarCorreo: (m) => sendEmail(m),
    despublicarFicha: (slug) => fijarPublicacionDeFicha(slug, false),
    publicarFicha: (slug) => fijarPublicacionDeFicha(slug, true),
    alertar: (asunto, texto) => sendPagosAlert(asunto, texto),
    ahora: () => new Date(),
  };
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Registra el servicio que compra un pago aprobado (una vez por transacción) y
 * le confirma al comprador cómo sigue. Nunca lanza: un fallo aquí no puede
 * romper el procesamiento del pago, que ya quedó registrado y avisado.
 */
export async function registrarServicioDePago(
  tx: WompiTransaction,
  plan: Plan,
  deps: ServiciosDeps = defaultServiciosDeps(),
  opts: { renuevaServicioId?: string | null; alertarSiFalla?: boolean } = {},
): Promise<void> {
  if (plan.mode !== "pago" || !plan.dias) return;
  const alertarSiFalla = opts.alertarSiFalla ?? true;
  if (opts.renuevaServicioId) {
    // Una renovación nunca cae en «compra nueva» por un error: si falla, se reintenta en la próxima pasada.
    try {
      if (await aplicarRenovacionPagada(tx, plan, opts.renuevaServicioId, deps)) return;
    } catch (err) {
      console.error(`[vigencias] renovación de ${tx.id} sin aplicar (se reintenta):`, describe(err));
      return;
    }
  }
  try {
    const { servicio, creado } = await deps.store.registrar({
      txId: tx.id,
      reference: tx.reference || null,
      planId: plan.id,
      dias: plan.dias,
      clienteEmail: tx.customerEmail,
      clienteNombre: tx.customerName ?? null,
      clienteTelefono: tx.customerPhone ?? null,
    });
    if (!creado) return;
    const correo = correoPagoRecibido(servicio);
    if (correo && !(await deps.enviarCorreo(correo))) {
      console.error(`[vigencias] no se pudo enviar la confirmación del servicio ${servicio.id}`);
      // No hay reintento automático de este correo: CIC recibe el aviso y contacta al comprador.
      await deps
        .alertar(
          "No llegó la confirmación de pago al comprador",
          [`Plan: ${plan.nombre}`, `Cliente: ${[servicio.clienteNombre, servicio.clienteEmail, servicio.clienteTelefono].filter(Boolean).join(" · ")}`, "", "Escríbele para confirmarle el pago y los siguientes pasos."].join("\n"),
        )
        .catch(() => false);
    }
  } catch (err) {
    const pendiente = err instanceof ServiciosNoDisponibleError;
    console.error(`[vigencias] no se pudo registrar el servicio de ${tx.id}:`, describe(err));
    // Los reintentos (recargar el retorno, webhook, cron) no repiten la alerta: basta una por transacción.
    if (!alertarSiFalla) return;
    // El pago ya quedó avisado y la conciliación no vuelve a pasar por aquí: se avisa a CIC para registrarlo a mano.
    await deps
      .alertar(
        "Pago aprobado sin vigencia registrada",
        [
          `Transacción Wompi: ${tx.id}`,
          `Plan: ${plan.nombre}`,
          `Cliente: ${[tx.customerName, tx.customerEmail, tx.customerPhone].filter(Boolean).join(" · ") || "(sin datos)"}`,
          "",
          pendiente ? "Falta aplicar la migración 0004 en Supabase." : "Falló el registro. Revisa los registros del servidor.",
          "Este pago no aparecerá en /admin/vigencias hasta que se registre.",
        ].join("\n"),
      )
      .catch(() => false);
  }
}

/**
 * Renovación pagada desde el enlace del correo: extiende el servicio original (sin perder días vigentes)
 * en lugar de crear uno nuevo que quedaría pendiente mientras el viejo vence y despublica la ficha.
 * true si quedó resuelta (aplicada ahora o antes); false si hay que tratar el pago como compra nueva.
 */
async function aplicarRenovacionPagada(tx: WompiTransaction, plan: Plan, servicioId: string, deps: ServiciosDeps): Promise<boolean> {
  const s = await deps.store.obtener(servicioId);
  // Solo se renueva el mismo plan y un servicio que ya corre o venció; si no, es una compra nueva.
  if (!s || s.planId !== plan.id || s.estado === "pendiente_publicar" || s.estado === "descartado") return false;
  if (!(await deps.store.registrarRenovacion(tx.id, s.id))) return true; // ya aplicada por otro intento

  // Si la extensión no se aplica (error de red o cambio simultáneo), se libera el reclamo: el siguiente
  // intento (recarga del retorno o conciliación) la vuelve a aplicar en vez de darla por hecha.
  let renovado: Servicio | null = null;
  try {
    renovado = await deps.store.renovar(s.id, ventanaDeRenovacion(s, deps.ahora()), s.venceAt);
  } catch (err) {
    console.error(`[vigencias] no se pudo extender ${s.id}:`, describe(err));
  }
  if (!renovado) {
    await deps.store.liberarRenovacion(tx.id).catch(() => undefined);
    await deps
      .alertar(
        "Renovación pagada pendiente de aplicar",
        [`Transacción Wompi: ${tx.id}`, `Plan: ${plan.nombre}`, `Servicio: ${s.id}`, "", "Se reintenta sola; si persiste, renuévala a mano en /admin/vigencias."].join("\n"),
      )
      .catch(() => false);
    throw new Error(`renovación de ${s.id} sin aplicar`);
  }
  const fichaOk = !s.propertySlug || (await deps.publicarFicha(s.propertySlug));
  if (!fichaOk) {
    await deps
      .alertar(
        "Renovación pagada sin aplicar del todo",
        [
          `Transacción Wompi: ${tx.id}`,
          `Plan: ${plan.nombre}`,
          `Servicio: ${s.id}${s.propertySlug ? ` · ficha ${s.propertySlug}` : ""}`,
          "",
          "La vigencia se extendió, pero la ficha no se pudo volver a publicar: publícala a mano.",
        ].join("\n"),
      )
      .catch(() => false);
    return true;
  }
  const correo = correoRenovacionPagada(renovado);
  if (correo && !(await deps.enviarCorreo(correo))) console.error(`[vigencias] no se pudo enviar la confirmación de renovación de ${s.id}`);
  return true;
}

export interface ResumenVigencias {
  disponible: boolean;
  revisados: number;
  vencidos: number;
  avisosEnviados: number;
  sinCorreo: number;
  fallos: number;
}

/**
 * Revisión diaria: avisa 7 y 1 día antes; al vencer avisa y deja un día de gracia con la ficha publicada;
 * pasada la gracia despublica la ficha enlazada y marca el servicio como vencido. Cada paso es idempotente:
 * si un correo o una despublicación fallan, se reintentan en la siguiente
 * corrida. Al final deja un resumen a CIC con quién debe recibir seguimiento.
 */
export async function revisarVencimientos(deps: ServiciosDeps = defaultServiciosDeps()): Promise<ResumenVigencias> {
  const r: ResumenVigencias = { disponible: true, revisados: 0, vencidos: 0, avisosEnviados: 0, sinCorreo: 0, fallos: 0 };
  let servicios: Servicio[];
  try {
    servicios = await deps.store.listarParaRevision();
  } catch (err) {
    if (err instanceof ServiciosNoDisponibleError) return { ...r, disponible: false };
    throw err;
  }

  const ahora = deps.ahora();
  const lineas: string[] = [];

  // Pagos que siguen sin activar: el reloj no corre hasta que CIC publique y active. Se recuerdan cada día.
  try {
    const todos = await deps.store.listar();
    for (const p of todos) {
      if (p.estado !== "pendiente_publicar") continue;
      const dias = Math.floor((ahora.getTime() - new Date(p.createdAt).getTime()) / 86_400_000);
      if (![2, 7, 14].includes(dias)) continue; // recordatorio acotado, no un correo eterno
      const quien = [p.clienteNombre, p.clienteEmail, p.clienteTelefono].filter(Boolean).join(" · ") || "(sin datos)";
      lineas.push(`SIN ACTIVAR hace ${dias} días: ${getPlan(p.planId)?.nombre ?? p.planId}. Cliente: ${quien}. Actívalo en /admin/vigencias al publicar.`);
    }
  } catch (err) {
    console.error("[vigencias] no se pudieron listar los pendientes:", describe(err));
  }

  for (const s of servicios) {
    const accion = accionDeHoy(s, ahora);
    if (!accion.vencer && !accion.aviso) continue;
    r.revisados += 1;
    const plan = getPlan(s.planId)?.nombre ?? s.planId;
    const quien = [s.clienteNombre, s.clienteEmail, s.clienteTelefono].filter(Boolean).join(" · ") || "(sin datos)";

    try {
      // Si otro servicio vigente cubre la misma ficha (una renovación), esta ya no se apaga:
      // el servicio viejo se cierra sin despublicar ni avisar de un vencimiento que no ocurrió
      // (tampoco durante el día de gracia).
      const yaVencio = s.estado === "activo" && s.venceAt !== null && new Date(s.venceAt).getTime() <= ahora.getTime();
      const cubierta =
        yaVencio &&
        s.propertySlug &&
        servicios.some((o) => o.id !== s.id && o.estado === "activo" && o.propertySlug === s.propertySlug && o.venceAt && new Date(o.venceAt).getTime() > ahora.getTime());
      if (cubierta) {
        await deps.store.marcarVencido(s.id, { ahora });
        await deps.store.marcarAviso(s.id, "vencido");
        lineas.push(`CERRADO sin despublicar: ${s.propertySlug} sigue cubierta por una renovación vigente (${plan}). Cliente: ${quien}`);
        continue;
      }
      if (accion.vencer) {
        // Primero se despublica: si falla, el servicio sigue activo y se reintenta mañana.
        if (s.propertySlug && !(await deps.despublicarFicha(s.propertySlug))) {
          r.fallos += 1;
          lineas.push(`NO SE PUDO despublicar ${s.propertySlug} (${plan}). Se reintenta mañana. Cliente: ${quien}`);
          continue;
        }
        await deps.store.marcarVencido(s.id, { ahora });
        r.vencidos += 1;
        lineas.push(`VENCIÓ ${plan}${s.propertySlug ? ` · ficha ${s.propertySlug} despublicada` : " · paquete: revisa sus fichas en el panel"}. Cliente: ${quien}`);
      }

      if (accion.aviso) {
        const correo = correoDeAviso(s, accion.aviso, { gracia: accion.gracia });
        if (!correo) {
          await deps.store.marcarAviso(s.id, accion.aviso); // sin correo no se insiste cada día
          r.sinCorreo += 1;
          lineas.push(`SIN CORREO: avisa por WhatsApp (${accion.aviso}) a ${quien} · ${plan} · vence ${s.venceAt ? fechaLarga(s.venceAt) : "—"}`);
        } else if (await deps.enviarCorreo(correo)) {
          await deps.store.marcarAviso(s.id, accion.aviso);
          r.avisosEnviados += 1;
          lineas.push(`Aviso ${accion.aviso} enviado a ${s.clienteEmail} · ${plan}`);
        } else {
          r.fallos += 1;
          lineas.push(`NO SE ENVIÓ el aviso ${accion.aviso} a ${s.clienteEmail} · ${plan}. Se reintenta mañana.`);
        }
      }
    } catch (err) {
      r.fallos += 1;
      console.error(`[vigencias] fallo con el servicio ${s.id}:`, describe(err));
    }
  }

  if (lineas.length > 0) {
    await deps.alertar(
      r.vencidos || r.avisosEnviados || r.fallos || r.sinCorreo ? `Vigencias: ${r.vencidos} vencidos, ${r.avisosEnviados} avisos` : "Vigencias: pagos sin activar",
      [...lineas, "", "Detalle y acciones en /admin/vigencias."].join("\n"),
    );
  }
  return r;
}
