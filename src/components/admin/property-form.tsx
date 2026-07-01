"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Loader2, Save } from "lucide-react";
import { CloudinaryUploader } from "./cloudinary-uploader";
import type { PropertyFormState } from "@/lib/actions/admin-properties";
import {
  PROPERTY_STATUSES,
  PROPERTY_STATUS_LABELS,
  PROPERTY_TYPES,
  PROPERTY_TYPE_LABELS,
  type Property,
} from "@/lib/domain";

type Action = (prev: PropertyFormState, formData: FormData) => Promise<PropertyFormState>;

const input =
  "h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-sm text-ink transition-colors focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-200";
const label = "mb-1.5 block text-sm font-medium text-ink-soft";
const textareaClass =
  "w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink transition-colors focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-200";

function Field({
  name,
  label: l,
  defaultValue,
  type = "text",
  required,
  placeholder,
  error,
}: {
  name: string;
  label: string;
  defaultValue?: string | number;
  type?: string;
  required?: boolean;
  placeholder?: string;
  error?: string;
}) {
  return (
    <div>
      <label className={label} htmlFor={name}>
        {l} {required && <span className="text-rose-500">*</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className={input}
        required={required}
      />
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}

export function PropertyForm({
  action,
  property,
}: {
  action: Action;
  property?: Property;
}) {
  const [state, formAction, isPending] = useActionState(action, {});
  const c = property?.caracteristicas;
  const u = property?.ubicacion;
  const videoUrl = property?.medios.find((m) => m.type === "video")?.url;
  const [imagenes, setImagenes] = useState(
    property?.medios.filter((m) => m.type === "image").map((m) => m.url).join("\n") ?? "",
  );

  const appendImages = (urls: string[]) =>
    setImagenes((prev) => [prev.trim(), ...urls].filter(Boolean).join("\n"));

  return (
    <form action={formAction} className="space-y-8">
      {state.error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {state.error}
        </div>
      )}

      {/* Datos principales */}
      <section className="rounded-2xl border border-line bg-white p-6">
        <h2 className="mb-4 text-lg font-bold tracking-tight text-ink">Datos principales</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field name="titulo" label="Título" defaultValue={property?.titulo} required error={state.errors?.titulo} />
          </div>
          <div>
            <label className={label} htmlFor="tipo">Tipo</label>
            <select id="tipo" name="tipo" defaultValue={property?.tipo ?? "apartamento"} className={input}>
              {PROPERTY_TYPES.map((t) => (
                <option key={t} value={t}>{PROPERTY_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={label} htmlFor="estado">Estado</label>
            <select id="estado" name="estado" defaultValue={property?.estado ?? "disponible"} className={input}>
              {PROPERTY_STATUSES.map((s) => (
                <option key={s} value={s}>{PROPERTY_STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <Field name="precio" label="Precio de venta (COP)" type="number" defaultValue={property?.precio} required error={state.errors?.precio} />
          <Field name="administracion" label="Administración (COP)" type="number" defaultValue={property?.administracion} />
        </div>
      </section>

      {/* Ubicación */}
      <section className="rounded-2xl border border-line bg-white p-6">
        <h2 className="mb-4 text-lg font-bold tracking-tight text-ink">Ubicación</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="ciudad" label="Ciudad" defaultValue={u?.ciudad} required error={state.errors?.ciudad} />
          <Field name="sector" label="Sector / zona" defaultValue={u?.sector} />
          <Field name="conjunto" label="Nombre del conjunto o edificio" defaultValue={u?.conjunto} />
          <Field name="direccion" label="Dirección (privada)" defaultValue={u?.direccion} />
        </div>
      </section>

      {/* Especificaciones */}
      <section className="rounded-2xl border border-line bg-white p-6">
        <h2 className="mb-4 text-lg font-bold tracking-tight text-ink">Especificaciones</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field name="habitaciones" label="Habitaciones" type="number" defaultValue={c?.habitaciones} />
          <Field name="banos" label="Baños" type="number" defaultValue={c?.banos} />
          <Field name="area" label="Área (m²)" type="number" defaultValue={c?.area} />
        </div>
      </section>

      {/* Descripción */}
      <section className="rounded-2xl border border-line bg-white p-6">
        <h2 className="mb-4 text-lg font-bold tracking-tight text-ink">Descripción</h2>
        <div>
          <label className={label} htmlFor="descripcion">Descripción general (intro breve del inmueble)</label>
          <textarea id="descripcion" name="descripcion" rows={5} defaultValue={property?.descripcion} className={textareaClass} />
        </div>
      </section>

      {/* Medios */}
      <section className="rounded-2xl border border-line bg-white p-6">
        <h2 className="mb-1 text-lg font-bold tracking-tight text-ink">Medios</h2>
        <p className="mb-4 text-sm text-muted">
          Sube imágenes (se almacenan en Cloudinary) o pega URLs, una por línea. La primera será la portada.
        </p>
        <div className="space-y-4">
          <CloudinaryUploader onUploaded={appendImages} />
          <div>
            <label className={label} htmlFor="imagenes">Imágenes (una URL por línea)</label>
            <textarea
              id="imagenes"
              name="imagenes"
              rows={4}
              value={imagenes}
              onChange={(e) => setImagenes(e.target.value)}
              className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 font-mono text-xs text-ink transition-colors focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
          </div>
          <Field name="videoUrl" label="URL de video (YouTube, opcional)" defaultValue={videoUrl} placeholder="https://youtu.be/..." />
        </div>
      </section>

      {/* Propietario + publicación */}
      <section className="rounded-2xl border border-line bg-white p-6">
        <h2 className="mb-4 text-lg font-bold tracking-tight text-ink">Propietario (privado) y publicación</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field name="propietarioNombre" label="Nombre" defaultValue={property?.propietario?.nombre} />
          <Field name="propietarioTelefono" label="Teléfono" defaultValue={property?.propietario?.telefono} />
          <Field name="propietarioEmail" label="Email" defaultValue={property?.propietario?.email} />
        </div>
        <div className="mt-4">
          <label htmlFor="notasInternas" className="mb-1.5 block text-sm font-medium text-ink-soft">
            Notas internas (privadas: negociación, llaves, observaciones)
          </label>
          <textarea
            id="notasInternas"
            name="notasInternas"
            rows={3}
            defaultValue={property?.notasInternas}
            className={textareaClass}
          />
        </div>
        <div className="mt-4">
          <Field name="driveFolderId" label="ID carpeta de Google Drive (opcional)" defaultValue={property?.driveFolderId} />
        </div>
        <div className="mt-4 flex flex-wrap gap-6">
          <label className="flex items-center gap-2 text-sm font-medium text-ink-soft">
            <input type="checkbox" name="publicado" defaultChecked={property?.publicado ?? true} className="h-4 w-4 accent-brand-600" />
            Publicado (visible en el sitio)
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-ink-soft">
            <input type="checkbox" name="destacado" defaultChecked={property?.destacado ?? false} className="h-4 w-4 accent-brand-600" />
            Destacado
          </label>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-700 px-6 font-semibold text-white shadow-[0_10px_26px_-10px_rgba(4,125,91,0.8)] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-brand-800 active:scale-[0.98] disabled:opacity-60"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Guardar
        </button>
        <Link href="/admin/inmuebles" className="text-sm font-medium text-muted hover:text-ink">
          Cancelar
        </Link>
      </div>
    </form>
  );
}
