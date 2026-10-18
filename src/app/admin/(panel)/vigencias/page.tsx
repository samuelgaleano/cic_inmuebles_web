import { MessageCircle } from "lucide-react";
import Link from "next/link";
import { BotonEnviar } from "@/components/admin/boton-enviar";
import {
  activarServicioAction,
  asignarFichaAction,
  descartarServicioAction,
  renovarServicioAction,
  restaurarServicioAction,
  revisarVigenciasAhoraAction,
  vencerServicioAction,
} from "@/lib/actions/admin-vigencias";
import { getPlan } from "@/lib/config/plans";
import { getRepository } from "@/lib/data";
import { enlaceDeRenovacion } from "@/lib/servicios/correos";
import { getServiciosStore, ServiciosNoDisponibleError } from "@/lib/servicios/store";
import { diasRestantes, DIAS_DE_GRACIA, ETIQUETA_ESTADO, fechaLarga, finDeGracia, type Servicio } from "@/lib/servicios/vigencia";
import { enlaceWhatsApp } from "@/lib/utils/telefono";

export const dynamic = "force-dynamic";

const ESTILO_ESTADO: Record<Servicio["estado"], string> = {
  pendiente_publicar: "bg-accent-500/15 text-accent-600",
  activo: "bg-brand-50 text-brand-700",
  vencido: "bg-ink/[0.07] text-muted",
  descartado: "bg-ink/[0.04] text-muted",
};

const boton =
  "rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-semibold text-ink-soft transition-colors hover:border-ink hover:text-ink";

function Fila({ s, estimadoPrevio }: { s: Servicio; estimadoPrevio?: string }) {
  const plan = getPlan(s.planId);
  const restan = s.venceAt ? diasRestantes(s.venceAt, new Date()) : null;
  const wa = s.clienteTelefono ? enlaceWhatsApp(s.clienteTelefono, `Hola, te escribimos de CIC Inmuebles sobre tu publicación (${plan?.nombre ?? s.planId}).`) : undefined;
  const esPaquete = Boolean(plan?.espacios);

  return (
    <tr className="align-top transition-colors hover:bg-surface">
      <td className="px-4 py-3">
        <p className="font-medium text-ink">{s.clienteNombre ?? "(sin nombre)"}</p>
        {s.clienteEmail && <p className="text-xs text-muted">{s.clienteEmail}</p>}
        {s.clienteTelefono && <p className="text-xs text-muted">{s.clienteTelefono}</p>}
      </td>
      <td className="px-4 py-3 text-xs text-ink-soft">
        <p className="font-medium text-ink">{plan?.nombre ?? s.planId}</p>
        <p>{s.dias} días{esPaquete ? ` · hasta ${plan?.espacios} inmuebles` : ""}</p>
      </td>
      <td className="px-4 py-3">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${ESTILO_ESTADO[s.estado]}`}>{ETIQUETA_ESTADO[s.estado]}</span>
      </td>
      <td className="px-4 py-3 text-xs text-ink-soft">
        {s.venceAt ? (
          <>
            <p>Vence {fechaLarga(s.venceAt)}</p>
            <p className={restan !== null && restan <= 7 ? "font-semibold text-accent-600" : "text-muted"}>
              {restan !== null && restan > 0
                ? `Faltan ${restan} día${restan === 1 ? "" : "s"}`
                : s.estado === "activo" && new Date() < finDeGracia(s.venceAt)
                  ? `Venció · en gracia hasta ${fechaLarga(finDeGracia(s.venceAt).toISOString())}`
                  : "Ya venció"}
            </p>
          </>
        ) : (
          <p className="text-muted">El reloj arranca al activarla</p>
        )}
        {estimadoPrevio && <p className="mt-1 text-muted">¿Renovación de «{estimadoPrevio}»?</p>}
      </td>
      <td className="px-4 py-3 text-xs">
        {s.propertySlug ? (
          <a href={`/inmuebles/${s.propertySlug}`} className="font-medium text-brand-700 underline underline-offset-2" target="_blank" rel="noreferrer">
            {s.propertySlug}
          </a>
        ) : esPaquete ? (
          <span className="text-muted">Paquete: sus fichas se gestionan en Inmuebles</span>
        ) : (
          <span className="text-muted">Sin ficha enlazada</span>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col items-end gap-2">
          {s.estado === "pendiente_publicar" && (
            <form action={activarServicioAction} className="flex items-center gap-1.5">
              <input type="hidden" name="id" value={s.id} />
              <input
                name="slug"
                list="fichas"
                defaultValue={estimadoPrevio ?? ""}
                placeholder={esPaquete ? "(paquete: sin ficha)" : "ficha (slug)"}
                aria-label="Ficha a publicar"
                className="h-9 w-40 rounded-lg border border-line bg-surface px-2.5 text-xs focus:border-brand-500 focus:bg-white focus:outline-none"
              />
              <BotonEnviar className="rounded-lg bg-brand-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-800">
                Activar hoy
              </BotonEnviar>
            </form>
          )}
          {(s.estado === "activo" || s.estado === "vencido") && (
            <form action={renovarServicioAction}>
              <input type="hidden" name="id" value={s.id} />
              <BotonEnviar className={boton}>Sumar {s.dias} días</BotonEnviar>
            </form>
          )}
          {s.estado === "activo" && (
            <form action={vencerServicioAction}>
              <input type="hidden" name="id" value={s.id} />
              <BotonEnviar className={boton}>Vencer ahora</BotonEnviar>
            </form>
          )}
          {(s.estado === "pendiente_publicar" || s.estado === "vencido") && (
            // Para pagos reversados, reembolsados, pruebas o que no se van a publicar: sale de la lista sin avisar al cliente
            // y sin borrar el pago (se puede restaurar desde «Ver descartados»).
            <form action={descartarServicioAction}>
              <input type="hidden" name="id" value={s.id} />
              <BotonEnviar className={boton}>Descartar (sin correo)</BotonEnviar>
            </form>
          )}
          {s.estado === "descartado" && (
            <form action={restaurarServicioAction}>
              <input type="hidden" name="id" value={s.id} />
              <BotonEnviar className={boton}>Restaurar</BotonEnviar>
            </form>
          )}
          {(s.estado === "activo" || s.estado === "vencido") && !s.propertySlug && !esPaquete && (
            <form action={asignarFichaAction} className="flex items-center gap-1.5">
              <input type="hidden" name="id" value={s.id} />
              <input name="slug" list="fichas" placeholder="enlazar ficha" aria-label="Ficha a enlazar" className="h-9 w-36 rounded-lg border border-line bg-surface px-2.5 text-xs focus:border-brand-500 focus:outline-none" />
              <BotonEnviar className={boton}>Enlazar</BotonEnviar>
            </form>
          )}
          <div className="flex items-center gap-1">
            {wa && (
              <a href={wa} target="_blank" rel="noreferrer" aria-label="Escribir por WhatsApp" className="flex h-9 w-9 items-center justify-center rounded-lg text-brand-700 hover:bg-brand-50">
                <MessageCircle className="h-4 w-4" />
              </a>
            )}
            {(s.estado === "activo" || s.estado === "vencido") && (
              <a href={enlaceDeRenovacion(s)} target="_blank" rel="noreferrer" className="text-xs font-medium text-muted underline underline-offset-2 hover:text-ink">
                Enlace de renovación
              </a>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

export default async function AdminVigenciasPage({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  const verDescartados = (await searchParams).ver === "descartados";
  let servicios: Servicio[] = [];
  let disponible = true;
  try {
    servicios = await getServiciosStore().listar();
  } catch (err) {
    if (err instanceof ServiciosNoDisponibleError) disponible = false;
    else throw err;
  }

  const fichas = (await getRepository().properties.list()).map((p) => p.slug);
  const orden = { pendiente_publicar: 0, activo: 1, vencido: 2, descartado: 3 } as const;
  const descartados = servicios.filter((s) => s.estado === "descartado").length;
  if (!verDescartados) servicios = servicios.filter((s) => s.estado !== "descartado");
  servicios.sort((a, b) => orden[a.estado] - orden[b.estado] || (a.venceAt ?? "").localeCompare(b.venceAt ?? ""));

  // Un pago pendiente con el mismo correo y plan que uno anterior suele ser su renovación: se sugiere su ficha.
  const previoDe = (s: Servicio) =>
    servicios.find((x) => x.id !== s.id && (x.estado === "activo" || x.estado === "vencido") && x.planId === s.planId && x.clienteEmail && x.clienteEmail === s.clienteEmail)
      ?.propertySlug ?? undefined;

  const pendientes = servicios.filter((s) => s.estado === "pendiente_publicar").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Vigencias</h1>
          <p className="mt-0.5 text-sm text-muted">
            {servicios.length} servicio{servicios.length === 1 ? "" : "s"} · {pendientes} por activar. La vigencia empieza a contar al activarlo,
            no al pagar. Se avisa 7 y 1 día antes; al vencer hay {DIAS_DE_GRACIA} día de gracia con la ficha publicada y después se desactiva.
            {descartados > 0 && (
              <>
                {" "}
                <Link href={verDescartados ? "/admin/vigencias" : "/admin/vigencias?ver=descartados"} className="font-medium text-brand-700 underline underline-offset-2">
                  {verDescartados ? "Ocultar descartados" : `Ver descartados (${descartados})`}
                </Link>
              </>
            )}
          </p>
        </div>
        {disponible && (
          <form action={revisarVigenciasAhoraAction}>
            <BotonEnviar className={boton}>Revisar vencimientos ahora</BotonEnviar>
          </form>
        )}
      </div>

      {!disponible && (
        <p role="status" className="rounded-2xl border border-line bg-surface p-4 text-sm text-ink-soft">
          Falta crear la tabla de servicios. Ejecuta el archivo <code className="rounded bg-white px-1.5 py-0.5">supabase/migrations/0004_servicios_publicacion.sql</code> en el
          SQL Editor de Supabase. Mientras tanto los pagos se procesan igual, pero no se registran vigencias.
        </p>
      )}

      {disponible && (
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-surface text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Cliente</th>
                <th className="px-4 py-3 font-semibold">Plan</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 font-semibold">Vigencia</th>
                <th className="px-4 py-3 font-semibold">Ficha</th>
                <th className="px-4 py-3 text-right font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {servicios.map((s) => (
                <Fila key={s.id} s={s} estimadoPrevio={s.estado === "pendiente_publicar" ? previoDe(s) : undefined} />
              ))}
              {servicios.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted">
                    Todavía no hay servicios. Aparecen aquí cuando un cliente paga un plan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <datalist id="fichas">
        {fichas.map((f) => (
          <option key={f} value={f} />
        ))}
      </datalist>
    </div>
  );
}
