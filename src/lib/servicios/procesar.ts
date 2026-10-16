import { getPlan, type Plan } from "@/lib/config/plans";
import type { WompiTransaction } from "@/lib/integrations/wompi";
import { sendPagosAlert } from "@/lib/notifications/payment";
import { sendEmail } from "@/lib/notifications/resend";
import { correoDeAviso, correoPagoRecibido, type CorreoSaliente } from "./correos";
import { fijarPublicacionDeFicha } from "./ficha";
import { getServiciosStore, ServiciosNoDisponibleError, type ServiciosStore } from "./store";
import { accionDeHoy, fechaLarga, type Servicio } from "./vigencia";

export interface ServiciosDeps {
  store: ServiciosStore;
  enviarCorreo: (m: CorreoSaliente) => Promise<boolean>;
  /** false si no se pudo despublicar (se reintenta al día siguiente). */
  despublicarFicha: (slug: string) => Promise<boolean>;
  alertar: (asunto: string, texto: string) => Promise<boolean>;
  ahora: () => Date;
}

export function defaultServiciosDeps(): ServiciosDeps {
  return {
    store: getServiciosStore(),
    enviarCorreo: (m) => sendEmail(m),
    despublicarFicha: (slug) => fijarPublicacionDeFicha(slug, false),
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
): Promise<void> {
  if (plan.mode !== "pago" || !plan.dias) return;
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
    }
  } catch (err) {
    const pendiente = err instanceof ServiciosNoDisponibleError;
    console.error(`[vigencias] no se pudo registrar el servicio de ${tx.id}:`, describe(err));
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

export interface ResumenVigencias {
  disponible: boolean;
  revisados: number;
  vencidos: number;
  avisosEnviados: number;
  sinCorreo: number;
  fallos: number;
}

/**
 * Revisión diaria: avisa 7 y 1 día antes, y al vencer despublica la ficha
 * enlazada, marca el servicio como vencido y avisa. Cada paso es idempotente:
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

  for (const s of servicios) {
    const accion = accionDeHoy(s, ahora);
    if (!accion.vencer && !accion.aviso) continue;
    r.revisados += 1;
    const plan = getPlan(s.planId)?.nombre ?? s.planId;
    const quien = [s.clienteNombre, s.clienteEmail, s.clienteTelefono].filter(Boolean).join(" · ") || "(sin datos)";

    try {
      if (accion.vencer) {
        // Si otro servicio vigente cubre la misma ficha (una renovación), esta ya no se apaga:
        // el servicio viejo se cierra sin despublicar ni avisar de un vencimiento que no ocurrió.
        const cubierta =
          s.propertySlug &&
          servicios.some((o) => o.id !== s.id && o.estado === "activo" && o.propertySlug === s.propertySlug && o.venceAt && new Date(o.venceAt).getTime() > ahora.getTime());
        if (cubierta) {
          await deps.store.marcarVencido(s.id, { ahora });
          await deps.store.marcarAviso(s.id, "vencido");
          lineas.push(`CERRADO sin despublicar: ${s.propertySlug} sigue cubierta por una renovación vigente (${plan}). Cliente: ${quien}`);
          continue;
        }
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
        const correo = correoDeAviso(s, accion.aviso);
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
      `Vigencias: ${r.vencidos} vencidos, ${r.avisosEnviados} avisos`,
      [...lineas, "", "Detalle y acciones en /admin/vigencias."].join("\n"),
    );
  }
  return r;
}
