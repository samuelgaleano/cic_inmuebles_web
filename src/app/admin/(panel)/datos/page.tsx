import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { ImportarHojaForm } from "@/components/admin/importar-hoja-form";
import { getCrmStore } from "@/lib/crm/store";
import { getRepository } from "@/lib/data";
import { DATASETS, PLANTILLAS, type Dataset } from "@/lib/export/datasets";
import { getServiciosStore } from "@/lib/servicios/store";

export const dynamic = "force-dynamic";

const DESCRIPCION: Record<Dataset, string> = {
  inmuebles: "Todo el catálogo con las mismas columnas de la hoja de siempre.",
  contactos: "Personas y empresas, con lo que son para CIC y su última actividad.",
  vendedores: "Quién vende qué, precio, comisión y estado del pago.",
  compradores: "Qué busca cada comprador y los inmuebles que se le propusieron.",
  propuestas: "Cada inmueble propuesto a un comprador, con su estado.",
  seguimiento: "La línea de tiempo de todas las personas.",
  leads: "Lo que llega de los formularios del sitio.",
  planes: "Planes de publicación pagados, con su vigencia.",
};

async function contar(): Promise<Partial<Record<Dataset, number>>> {
  const n: Partial<Record<Dataset, number>> = {};
  const repo = getRepository();
  const crm = getCrmStore();
  try {
    const [props, leads] = await Promise.all([repo.properties.list(), repo.leads.list()]);
    n.inmuebles = props.length;
    n.leads = leads.length;
  } catch {
    /* sin conteo */
  }
  try {
    const [contactos, captaciones, busquedas] = await Promise.all([crm.listarContactos({ incluirArchivados: true }), crm.listarCaptaciones(), crm.listarBusquedas()]);
    n.contactos = contactos.length;
    n.vendedores = captaciones.length;
    n.compradores = busquedas.length;
    n.propuestas = (await crm.listarPropuestas(busquedas.map((b) => b.id))).length;
  } catch {
    /* el CRM aún no tiene sus tablas */
  }
  try {
    n.planes = (await getServiciosStore().listar()).length;
  } catch {
    /* sin vigencias */
  }
  return n;
}

export default async function AdminDatosPage() {
  const cuentas = await contar();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Datos</h1>
        <p className="mt-0.5 max-w-2xl text-sm text-muted">
          Todo vive aquí, en el panel. Cuando necesites trabajarlo en una hoja, descárgalo; cuando tengas una hoja con vendedores o compradores, cárgala sin copiar fila por fila.
        </p>
      </div>

      <section aria-labelledby="descargar">
        <h2 id="descargar" className="mb-3 flex items-center gap-2 font-semibold text-ink">
          <Download className="h-5 w-5 text-brand-600" /> Descargar para Excel o Google Sheets
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {(Object.keys(DATASETS) as Dataset[]).map((d) => (
            <div key={d} className="flex flex-col justify-between rounded-2xl border border-line bg-white p-5">
              <div>
                <p className="font-semibold text-ink">{DATASETS[d]}</p>
                <p className="mt-0.5 text-xs text-muted">{cuentas[d] !== undefined ? `${cuentas[d]} registro${cuentas[d] === 1 ? "" : "s"}` : "—"}</p>
                <p className="mt-2 text-xs text-ink-soft">{DESCRIPCION[d]}</p>
              </div>
              <a
                href={`/api/admin/export/${d}`}
                download
                className="mt-4 inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-line px-3 text-sm font-medium text-ink-soft transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
              >
                <FileSpreadsheet className="h-4 w-4" /> Descargar CSV
              </a>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">Los archivos incluyen teléfonos y correos: guárdalos con cuidado. Se abren directo en Excel (con tildes) y en Google Sheets.</p>
      </section>

      <section aria-labelledby="cargar" className="rounded-2xl border border-line bg-white p-6">
        <h2 id="cargar" className="mb-1 flex items-center gap-2 font-semibold text-ink">
          <Upload className="h-5 w-5 text-brand-600" /> Cargar vendedores o compradores desde una hoja
        </h2>
        <p className="mb-4 max-w-3xl text-sm text-muted">
          Usa las columnas de la hoja «CRM CATALOGO BD». Primero pulsa «Revisar sin guardar»: te dice cuántos contactos y registros se crearían y qué filas tienen problemas. Puedes volver a cargar el mismo archivo sin duplicar nada.
        </p>
        <p className="mb-5 flex flex-wrap gap-3 text-xs">
          {(Object.keys(PLANTILLAS) as (keyof typeof PLANTILLAS)[]).map((p) => (
            <a key={p} href={`/api/admin/export/${p}`} download className="font-semibold text-brand-700 underline underline-offset-2">
              {PLANTILLAS[p]}
            </a>
          ))}
        </p>
        <ImportarHojaForm />
      </section>
    </div>
  );
}
