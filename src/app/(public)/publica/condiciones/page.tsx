import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Condiciones de publicación",
  description:
    "Condiciones generales de publicación de inmuebles en CIC Inmuebles para agentes, inmobiliarias y propietarios.",
  alternates: { canonical: "/publica/condiciones" },
};

const condiciones = [
  "El agente o propietario debe contar con autorización para promocionar el inmueble.",
  "La información suministrada debe ser verdadera, completa y verificable.",
  "Los precios deben mantenerse actualizados.",
  "Se deberá informar de inmediato cuando el inmueble sea vendido o retirado.",
  "CIC podrá desactivar publicaciones cuya disponibilidad no sea confirmada.",
  "CIC podrá solicitar confirmación periódica de disponibilidad.",
  "Las fotografías deben tener una calidad mínima aceptable: no se aceptan imágenes borrosas, capturas de pantalla ni fotografías con marcas de agua de terceros.",
  "CIC podrá solicitar el reemplazo de fotografías que no cumplan sus estándares.",
  "La publicación no garantiza un número determinado de visitas, contactos, ofertas o ventas.",
  "CIC podrá rechazar inmuebles con información incompleta, inconsistencias documentales o condiciones comerciales poco claras.",
  "Los paquetes funcionan mediante espacios activos, no mediante publicaciones ilimitadas.",
  "Los espacios no pueden transferirse, revenderse ni compartirse con terceros sin autorización.",
  "Los pagos de publicación no son reembolsables una vez creada y activada la ficha.",
  "Los inmuebles retirados podrán reemplazarse cuando el plan contratado permita rotación.",
  "Las condiciones de comisión deberán acordarse por escrito.",
  "El pago del Plan Contenido Profesional no garantiza la venta del inmueble.",
  "Los términos específicos de cada operación estarán sujetos al contrato firmado entre las partes.",
];

export default function CondicionesPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
      <Link href="/publica/agente" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:gap-2 hover:text-brand-700">
        <ArrowLeft className="h-4 w-4" /> Volver a los planes
      </Link>

      <h1 className="mt-6 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
        Condiciones de publicación
      </h1>
      <p className="mt-3 text-muted">
        Aplican a la publicación de inmuebles en CIC Inmuebles para agentes, inmobiliarias y
        propietarios.
      </p>

      <ul className="mt-8 space-y-3">
        {condiciones.map((c, i) => (
          <li key={i} className="flex gap-3 rounded-xl border border-line bg-white p-4 text-sm leading-relaxed text-ink-soft">
            <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">
              {i + 1}
            </span>
            <span>{c}</span>
          </li>
        ))}
      </ul>

      <p className="mt-8 text-sm text-muted">
        ¿Dudas sobre las condiciones?{" "}
        <Link href="/contacto" className="font-semibold text-brand-700 hover:underline">Escríbenos</Link>.
      </p>
    </div>
  );
}
