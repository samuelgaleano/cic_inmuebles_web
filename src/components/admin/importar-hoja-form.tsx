"use client";

import { useActionState } from "react";
import { importarHojaAction, type EstadoCarga } from "@/lib/actions/admin-datos";

const campo =
  "w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink transition-colors focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-200";

/** Carga de vendedores y compradores desde una hoja: primero «Revisar» (cuenta sin guardar), luego «Cargar». */
export function ImportarHojaForm() {
  const [r, accion, pendiente] = useActionState<EstadoCarga, FormData>(importarHojaAction, null);

  return (
    <form action={accion} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-xs font-semibold text-ink-soft">
          La hoja es de
          <select name="tipo" defaultValue="vendedores" className={`${campo} mt-1 h-10`}>
            <option value="vendedores">Vendedores</option>
            <option value="compradores">Compradores</option>
          </select>
        </label>
        <label className="block text-xs font-semibold text-ink-soft">
          Archivo CSV (de Excel o Google Sheets)
          <input name="archivo" type="file" accept=".csv,text/csv,text/plain" className={`${campo} mt-1`} />
        </label>
      </div>
      <label className="block text-xs font-semibold text-ink-soft">
        …o pega aquí las filas copiadas de la hoja (con la fila de títulos)
        <textarea name="texto" rows={5} className={`${campo} mt-1 font-mono text-xs`} placeholder="TIPO	NOMBRE	CELULAR	UBICACION	PRECIO…" />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button name="modo" value="simular" disabled={pendiente} className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold text-ink-soft transition-colors hover:border-ink hover:text-ink disabled:cursor-wait disabled:opacity-60">
          {pendiente ? "Procesando…" : "Revisar sin guardar"}
        </button>
        <button name="modo" value="importar" disabled={pendiente} className="rounded-lg bg-brand-700 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-800 disabled:cursor-wait disabled:opacity-60">
          Cargar al CRM
        </button>
      </div>

      {r && (
        <div role="status" className="rounded-xl border border-line bg-surface p-4 text-sm text-ink-soft">
          {r.fatal ? (
            <p className="font-medium text-rose-700">{r.fatal}</p>
          ) : (
            <>
              <p className="font-semibold text-ink">{r.simulacion ? "Así quedaría (no se guardó nada):" : "Carga terminada:"}</p>
              <ul className="mt-2 list-disc space-y-0.5 pl-5">
                <li>{r.filas} fila{r.filas === 1 ? "" : "s"} con datos</li>
                <li>
                  {r.contactosNuevos} contacto{r.contactosNuevos === 1 ? "" : "s"} nuevo{r.contactosNuevos === 1 ? "" : "s"} · {r.contactosExistentes} ya existía{r.contactosExistentes === 1 ? "" : "n"}
                </li>
                <li>
                  {r.creados} registro{r.creados === 1 ? "" : "s"} {r.simulacion ? "se crearía" : "creado"}
                  {r.creados === 1 ? "" : r.simulacion ? "n" : "s"} · {r.yaExistian} ya estaba{r.yaExistian === 1 ? "" : "n"} cargado{r.yaExistian === 1 ? "" : "s"}
                </li>
                {r.propuestas > 0 && <li>{r.propuestas} inmueble{r.propuestas === 1 ? "" : "s"} propuesto{r.propuestas === 1 ? "" : "s"}</li>}
              </ul>
              {r.errores.length > 0 && (
                <div className="mt-3">
                  <p className="font-semibold text-rose-700">Filas que no se pudieron cargar ({r.errores.length}):</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-rose-700">
                    {r.errores.map((e) => (
                      <li key={`${e.fila}-${e.motivo}`}>
                        Fila {e.fila}: {e.motivo}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </form>
  );
}
