import { CheckCircle2, CircleDashed, ExternalLink, RotateCw, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { BotonEnviar } from "@/components/admin/boton-enviar";
import { revisarVigenciasAhoraAction } from "@/lib/actions/admin-vigencias";
import { resyncSheetAction } from "@/lib/actions/admin-sheets";
import { getCrmStore } from "@/lib/crm/store";
import { isSupabaseConfigured } from "@/lib/data/supabase/client";
import { isCloudinaryConfigured } from "@/lib/integrations/cloudinary";
import { isDriveConfigured } from "@/lib/integrations/drive";
import { isSheetsConfigured, sheetUrl } from "@/lib/integrations/sheets";
import { isWompiConfigured, wompiEnvironment } from "@/lib/integrations/wompi";
import { getServiciosStore } from "@/lib/servicios/store";
import { getSupabaseAdmin } from "@/lib/data/supabase/client";
import { estadoDeLatido, LATIDOS, leerLatidos, type EstadoLatido, type Latido } from "@/lib/salud/latidos";
import { formatoBogota } from "@/lib/utils/hora-bogota";

const NOMBRE_PROCESO: Record<string, string> = {
  "cron-sync": "Drive, catálogo y hoja (1:00 a. m.)",
  "cron-diario": "Conciliación de pagos (1:30 a. m.)",
  "cron-vigencias": "Vencimientos de planes (1:45 a. m.)",
  "cron-crm": "Resumen diario del CRM (7:00 a. m.)",
};
const TEXTO_LATIDO: Record<EstadoLatido | "sin-tabla", string> = {
  ok: "Al día",
  atrasado: "No corre hace más de 27 h",
  "con-fallos": "Última corrida con fallos",
  "sin-dato": "Aún sin corridas",
  "sin-tabla": "Falta la migración 0009",
};
const ESTILO_LATIDO: Record<EstadoLatido | "sin-tabla", string> = {
  ok: "bg-brand-50 text-brand-700",
  atrasado: "bg-rose-50 text-rose-700",
  "con-fallos": "bg-rose-50 text-rose-700",
  "sin-dato": "bg-ink/[0.07] text-muted",
  "sin-tabla": "bg-accent-500/15 text-accent-600",
};

/** Lo mismo que vigila el monitor externo (/api/salud), visto desde el panel, más las migraciones aplicadas. */
async function salud(): Promise<{ latidos: Latido[] | null; migraciones: { nombre: string; aplicada_at: string }[] | null } | null> {
  if (!isSupabaseConfigured()) return null;
  const [latidos, migraciones] = await Promise.all([
    leerLatidos().catch(() => null),
    getSupabaseAdmin()
      .from("migraciones_aplicadas")
      .select("nombre, aplicada_at")
      .order("nombre")
      .then(({ data, error }) => (error ? null : ((data ?? []) as { nombre: string; aplicada_at: string }[]))),
  ]);
  return { latidos, migraciones };
}

export const dynamic = "force-dynamic";

type Estado = "ok" | "falta" | "opcional" | "aviso";

interface Conexion {
  nombre: string;
  estado: Estado;
  detalle: string;
  acciones?: React.ReactNode;
}

const ETIQUETA: Record<Estado, string> = { ok: "Conectado", falta: "Falta configurar", opcional: "Opcional · apagado", aviso: "Revisar" };
const ESTILO: Record<Estado, string> = {
  ok: "bg-brand-50 text-brand-700",
  falta: "bg-rose-50 text-rose-700",
  opcional: "bg-ink/[0.07] text-muted",
  aviso: "bg-accent-500/15 text-accent-600",
};

const boton =
  "inline-flex h-9 items-center gap-1.5 rounded-xl border border-line px-3 text-sm font-medium text-ink-soft transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700";

async function tablaDisponible(f: () => Promise<boolean>): Promise<boolean> {
  try {
    return await f();
  } catch {
    return false;
  }
}

/** Solo se informa si cada pieza está configurada: nunca se muestra el valor de una llave. */
async function conexiones(): Promise<Conexion[]> {
  const supabase = isSupabaseConfigured();
  const [crmOk, vigOk] = supabase
    ? await Promise.all([tablaDisponible(() => getCrmStore().disponible()), tablaDisponible(() => getServiciosStore().disponible())])
    : [true, true];
  const link = sheetUrl();
  const sheetsOn = isSheetsConfigured();
  const wompiAmbiente = wompiEnvironment();

  return [
    {
      nombre: "Base de datos (Supabase)",
      estado: supabase ? (crmOk && vigOk ? "ok" : "aviso") : "aviso",
      detalle: supabase
        ? `Es la fuente única de inmuebles, leads, CRM, pagos y vigencias. CRM: ${crmOk ? "listo" : "faltan sus tablas (migración 0007)"} · Vigencias: ${vigOk ? "listas" : "faltan sus tablas (migración 0004)"}.`
        : "Sin Supabase el sitio usa datos de ejemplo en memoria: lo que se guarde se pierde al reiniciar.",
    },
    {
      nombre: "Google Drive",
      estado: isDriveConfigured() ? "ok" : "opcional",
      detalle: "Carpeta con las fotos y la ficha de cada inmueble. De ahí se importan los inmuebles nuevos al catálogo.",
      acciones: (
        <Link href="/admin/inmuebles/importar" className={boton}>
          Importar desde Drive
        </Link>
      ),
    },
    {
      nombre: "Google Sheets (espejo opcional)",
      estado: sheetsOn ? "ok" : "opcional",
      detalle: sheetsOn
        ? "El catálogo se copia a una hoja cada vez que cambia. Ya no hace falta para trabajar: todo se ve y se descarga desde Datos. Puedes dejarlo como copia de respaldo."
        : "No hace falta. Todo se gestiona en el panel y se descarga desde Datos cuando se necesite en una hoja.",
      acciones: sheetsOn ? (
        <>
          {link && (
            <a href={link} target="_blank" rel="noopener noreferrer" className={boton}>
              <ExternalLink className="h-4 w-4" /> Abrir hoja
            </a>
          )}
          <form action={resyncSheetAction}>
            <BotonEnviar className={`${boton} bg-white`}>
              <RotateCw className="h-4 w-4" /> Sincronizar ahora
            </BotonEnviar>
          </form>
        </>
      ) : undefined,
    },
    {
      nombre: "Fotos (Cloudinary)",
      estado: isCloudinaryConfigured() ? "ok" : "opcional",
      detalle: "Almacena y optimiza las fotos que se suben desde el panel o se importan de Drive.",
    },
    {
      nombre: "Pagos (Wompi)",
      estado: !isWompiConfigured() ? "falta" : wompiAmbiente === "prod" ? "ok" : "aviso",
      detalle: !isWompiConfigured()
        ? "Faltan llaves: sin ellas no se pueden cobrar los planes de publicación."
        : wompiAmbiente === "prod"
          ? "Cobrando en producción. Cada pago queda registrado, avisa al equipo y abre su vigencia."
          : "Las llaves son de PRUEBAS: los pagos no son reales.",
      acciones: (
        <Link href="/admin/vigencias" className={boton}>
          Ver planes y vigencias
        </Link>
      ),
    },
    {
      nombre: "Correo (Resend)",
      estado: process.env.RESEND_API_KEY ? "ok" : "falta",
      detalle: process.env.RESEND_API_KEY
        ? "Envía los avisos de leads y pagos al equipo y los correos a los clientes (pago recibido, vencimientos, renovación)."
        : "Falta RESEND_API_KEY: no salen avisos ni correos a los clientes.",
    },
    {
      nombre: "Procesos programados",
      estado: process.env.CRON_SECRET ? "ok" : "falta",
      detalle:
        "Cada día a la 1:00 a. m. (hora de Bogotá) se sincroniza Drive y el catálogo; a la 1:30 a. m. se concilian los pagos y a la 1:45 a. m. se revisan los vencimientos (avisos, día de gracia y desactivación); a las 7:00 a. m. sale el resumen del CRM.",
      acciones: (
        <form action={revisarVigenciasAhoraAction}>
          <BotonEnviar className={`${boton} bg-white`}>Revisar vencimientos ahora</BotonEnviar>
        </form>
      ),
    },
  ];
}

export default async function AdminConexionesPage() {
  const [lista, estadoSalud] = await Promise.all([conexiones(), salud()]);
  const ahora = new Date();
  const icono = (e: Estado) => (e === "ok" ? <CheckCircle2 className="h-5 w-5 text-brand-600" /> : e === "opcional" ? <CircleDashed className="h-5 w-5 text-muted" /> : <TriangleAlert className="h-5 w-5 text-accent-600" />);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Conexiones</h1>
        <p className="mt-0.5 max-w-2xl text-sm text-muted">
          Qué está enchufado a la plataforma y qué procesos corren solos. Aquí nunca se muestran llaves ni contraseñas; solo si cada pieza está configurada.
        </p>
      </div>

      <ul className="grid gap-4 lg:grid-cols-2">
        {lista.map((c) => (
          <li key={c.nombre} className="flex flex-col justify-between rounded-2xl border border-line bg-white p-5">
            <div>
              <div className="flex items-start justify-between gap-3">
                <p className="flex items-center gap-2 font-semibold text-ink">
                  {icono(c.estado)} {c.nombre}
                </p>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${ESTILO[c.estado]}`}>{ETIQUETA[c.estado]}</span>
              </div>
              <p className="mt-2 text-sm text-ink-soft">{c.detalle}</p>
            </div>
            {c.acciones && <div className="mt-4 flex flex-wrap items-center gap-2">{c.acciones}</div>}
          </li>
        ))}
      </ul>

      {estadoSalud && (
        <section aria-labelledby="salud-titulo" className="rounded-2xl border border-line bg-white p-5">
          <h2 id="salud-titulo" className="font-semibold text-ink">Salud de los procesos</h2>
          <p className="mt-1 text-sm text-muted">
            Cada proceso deja aquí su última corrida. Un monitor externo revisa lo mismo cada pocas horas y avisa por correo si algo se detiene.
          </p>
          <ul className="mt-4 divide-y divide-line">
            {LATIDOS.map((n) => {
              const l = estadoSalud.latidos?.find((x) => x.nombre === n);
              const estado = estadoSalud.latidos === null ? "sin-tabla" : estadoDeLatido(l, ahora);
              return (
                <li key={n} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-ink">{NOMBRE_PROCESO[n] ?? n}</p>
                    <p className="text-xs text-muted">
                      {l?.okAt ? `Última corrida buena: ${formatoBogota(l.okAt)}` : "Sin corrida buena registrada"}
                      {l?.falloAt ? ` · Último fallo: ${formatoBogota(l.falloAt)}` : ""}
                    </p>
                  </div>
                  <span className={`w-fit shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${ESTILO_LATIDO[estado]}`}>{TEXTO_LATIDO[estado]}</span>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-muted">
            {estadoSalud.migraciones
              ? `Base de datos: ${estadoSalud.migraciones.length} migraciones registradas (última: ${estadoSalud.migraciones.at(-1)?.nombre ?? "ninguna"}).`
              : "Base de datos: falta el registro de migraciones (migración 0014)."}
          </p>
        </section>
      )}
    </div>
  );
}
