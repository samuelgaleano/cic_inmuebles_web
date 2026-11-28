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
import { asignarFichaAPaqueteAction, quitarFichaDePaqueteAction } from "@/lib/actions/admin-paquetes";
import { getPlan } from "@/lib/config/plans";
import { getRepository } from "@/lib/data";
import { PROPERTY_TYPE_LABELS } from "@/lib/domain/property";
import { enlaceDeRenovacion } from "@/lib/servicios/correos";
import { espaciosDe, MENSAJE_SIN_ESPACIO, textoEspacios } from "@/lib/servicios/paquetes";
import { enlaceRecordatorio } from "@/lib/servicios/recordatorio";
import { getServiciosStore, ServiciosNoDisponibleError, type DatosInmuebleGuardados, type FichaDePaquete } from "@/lib/servicios/store";
import { formatPrice } from "@/lib/utils/format";
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

/** Lo que el cliente dejó en el formulario posterior al pago, del más reciente al más antiguo. */
function DatosEnviados({ datos }: { datos: DatosInmuebleGuardados[] }) {
  return (
    <details className="mt-2 text-xs">
      <summary className="cursor-pointer font-semibold text-brand-700">
        Datos del inmueble ({datos.length})
      </summary>
      <ul className="mt-1.5 space-y-2">
        {datos.map((d) => (
          <li key={d.id} className="rounded-lg bg-surface p-2 text-ink-soft">
            <p className="font-medium text-ink">
              {PROPERTY_TYPE_LABELS[d.tipo as keyof typeof PROPERTY_TYPE_LABELS] ?? d.tipo} en {d.ciudad}
              {d.sector ? ` · ${d.sector}` : ""}
            </p>
            {d.precio && <p>{formatPrice(d.precio)}</p>}
            {d.descripcion && <p className="whitespace-pre-line">{d.descripcion}</p>}
            <p>
              Contacto de la ficha: {d.contactoNombre} · {d.contactoWhatsapp}
            </p>
            <p className="text-muted">Enviado {fechaLarga(d.createdAt)}</p>
          </li>
        ))}
      </ul>
    </details>
  );
}

/** Fichas que cubre un paquete: «N de M espacios», quitar una y asignar otra mientras quede espacio. */
function FichasDelPaquete({ s, espacios, fichas }: { s: Servicio; espacios: number; fichas: FichaDePaquete[] }) {
  const lleno = fichas.length >= espacios;
  return (
    <div className="space-y-1.5">
      <p className={`font-semibold ${lleno ? "text-accent-600" : "text-ink"}`}>{textoEspacios(fichas.length, espacios)}</p>
      {fichas.length > 0 && (
        <ul className="space-y-1">
          {fichas.map((f) => (
            <li key={f.propertyId} className="flex items-center gap-1.5">
              {f.slug ? (
                <a href={`/inmuebles/${f.slug}`} className="font-medium text-brand-700 underline underline-offset-2" target="_blank" rel="noreferrer">
                  {f.slug}
                </a>
              ) : (
                <span className="text-muted">(inmueble sin dirección)</span>
              )}
              <form action={quitarFichaDePaqueteAction}>
                <input type="hidden" name="id" value={s.id} />
                <input type="hidden" name="propertyId" value={f.propertyId} />
                <BotonEnviar className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-muted hover:bg-ink/[0.06] hover:text-ink">Quitar</BotonEnviar>
              </form>
            </li>
          ))}
        </ul>
      )}
      {s.estado === "activo" && !lleno && (
        <form action={asignarFichaAPaqueteAction} className="flex items-center gap-1.5">
          <input type="hidden" name="id" value={s.id} />
          <input name="slug" list="fichas" placeholder="ficha (slug)" aria-label="Ficha a asignar al paquete" className="h-9 w-36 rounded-lg border border-line bg-surface px-2.5 text-xs focus:border-brand-500 focus:outline-none" />
          <BotonEnviar className={boton}>Asignar</BotonEnviar>
        </form>
      )}
      {s.estado === "activo" && lleno && <p className="text-muted">Sin espacios libres: quita una ficha para poner otra.</p>}
      {s.estado !== "activo" && <p className="text-muted">Al vencer no se despublican solas: decide con el cliente.</p>}
    </div>
  );
}

function Fila({
  s,
  estimadoPrevio,
  fichas = [],
  datos = [],
  ahora,
}: {
  s: Servicio;
  estimadoPrevio?: string;
  fichas?: FichaDePaquete[];
  datos?: DatosInmuebleGuardados[];
  ahora: Date;
}) {
  const plan = getPlan(s.planId);
  const restan = s.venceAt ? diasRestantes(s.venceAt, ahora) : null;
  const wa = s.clienteTelefono ? enlaceWhatsApp(s.clienteTelefono, `Hola, te escribimos de CIC Inmuebles sobre tu publicación (${plan?.nombre ?? s.planId}).`) : undefined;
  const recordatorio = enlaceRecordatorio(s, ahora);
  const espacios = espaciosDe(s);
  const esPaquete = Boolean(espacios);

  return (
    <tr className="align-top transition-colors hover:bg-surface">
      <td className="px-4 py-3">
        <p className="font-medium text-ink">{s.clienteNombre ?? "(sin nombre)"}</p>
        {s.clienteEmail && <p className="text-xs text-muted">{s.clienteEmail}</p>}
        {s.clienteTelefono && <p className="text-xs text-muted">{s.clienteTelefono}</p>}
        {datos.length > 0 && <DatosEnviados datos={datos} />}
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
                : s.estado === "activo" && ahora < finDeGracia(s.venceAt)
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
        ) : espacios ? (
          s.estado === "pendiente_publicar" ? (
            <span className="text-muted">Paquete de {espacios} espacios: asigna sus fichas al activarlo</span>
          ) : (
            <FichasDelPaquete s={s} espacios={espacios} fichas={fichas} />
          )
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
          {recordatorio && (
            <a
              href={recordatorio}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-800"
            >
              <MessageCircle className="h-3.5 w-3.5" aria-hidden /> Recordar por WhatsApp
            </a>
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

/** Mensajes que dejan las acciones de paquetes al volver al panel (?aviso=...). */
const AVISOS: Record<string, string> = {
  ...MENSAJE_SIN_ESPACIO,
  ficha_inexistente: "No hay ningún inmueble con esa ficha (slug). Revisa cómo está escrita.",
  sin_tabla: "No se pudo asignar la ficha. Si persiste, falta aplicar supabase/migrations/0011_pagos_y_servicios.sql.",
};

export default async function AdminVigenciasPage({ searchParams }: { searchParams: Promise<{ ver?: string; aviso?: string }> }) {
  const sp = await searchParams;
  const verDescartados = sp.ver === "descartados";
  const aviso = sp.aviso && Object.hasOwn(AVISOS, sp.aviso) ? AVISOS[sp.aviso] : null;
  const ahora = new Date();
  const store = getServiciosStore();
  let servicios: Servicio[] = [];
  let disponible = true;
  try {
    servicios = await store.listar();
  } catch (err) {
    if (err instanceof ServiciosNoDisponibleError) disponible = false;
    else throw err;
  }

  // Fichas de los paquetes y datos que dejaron los clientes (tablas de 0011: sin ellas, vacío).
  const idsPaquetes = servicios.filter((s) => espaciosDe(s) && !s.propertySlug).map((s) => s.id);
  const [fichasPorServicio, datosPorServicio] = disponible
    ? await Promise.all([
        store.fichasDePaquetes(idsPaquetes).catch(() => new Map<string, FichaDePaquete[]>()),
        store.datosDeServicios(servicios.map((s) => s.id)).catch(() => new Map<string, DatosInmuebleGuardados[]>()),
      ])
    : [new Map<string, FichaDePaquete[]>(), new Map<string, DatosInmuebleGuardados[]>()];

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
            no al pagar. Se avisa 7 y 1 día antes; al vencer hay {DIAS_DE_GRACIA} día de gracia con la ficha publicada y después se desactiva. Las
            fichas de un paquete no se desactivan solas: el aviso las lista para decidir con el cliente.
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

      {aviso && (
        <p role="status" className="rounded-2xl border border-accent-500/40 bg-accent-500/10 p-4 text-sm text-ink">
          {aviso}
        </p>
      )}

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
                <Fila
                  key={s.id}
                  s={s}
                  ahora={ahora}
                  fichas={fichasPorServicio.get(s.id)}
                  datos={datosPorServicio.get(s.id)}
                  estimadoPrevio={s.estado === "pendiente_publicar" ? previoDe(s) : undefined}
                />
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
