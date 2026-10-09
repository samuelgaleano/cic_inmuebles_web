import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Condiciones de publicación",
  description:
    "Condiciones generales de publicación de inmuebles en CIC Inmuebles para agentes, inmobiliarias y propietarios.",
  alternates: { canonical: "/publica/condiciones" },
};

// El texto de cada condición es el aprobado por CIC: no se edita aquí. Solo se
// agrupan por tema para que se puedan leer de corrido; la numeración es continua
// porque los planes y el contrato se refieren a ellas por número.
const secciones: { titulo: string; condiciones: string[] }[] = [
  {
    titulo: "El inmueble y su información",
    condiciones: [
      "El agente o propietario debe contar con autorización para promocionar el inmueble.",
      "La información suministrada debe ser verdadera, completa y verificable.",
      "Los precios deben mantenerse actualizados.",
      "Se deberá informar de inmediato cuando el inmueble sea vendido o retirado.",
      "CIC podrá desactivar publicaciones cuya disponibilidad no sea confirmada.",
      "CIC podrá solicitar confirmación periódica de disponibilidad.",
    ],
  },
  {
    titulo: "Fotografías",
    condiciones: [
      "Las fotografías deben tener una calidad mínima aceptable: no se aceptan imágenes borrosas, capturas de pantalla ni fotografías con marcas de agua de terceros.",
      "CIC podrá solicitar el reemplazo de fotografías que no cumplan sus estándares.",
    ],
  },
  {
    titulo: "Alcance de la publicación",
    condiciones: [
      "La publicación no garantiza un número determinado de visitas, contactos, ofertas o ventas.",
      "CIC podrá rechazar inmuebles con información incompleta, inconsistencias documentales o condiciones comerciales poco claras.",
    ],
  },
  {
    titulo: "Espacios y pagos",
    condiciones: [
      "Los paquetes funcionan mediante espacios activos, no mediante publicaciones ilimitadas.",
      "Los espacios no pueden transferirse, revenderse ni compartirse con terceros sin autorización.",
      "Los pagos de publicación no son reembolsables una vez creada y activada la ficha.",
      "Los inmuebles retirados podrán reemplazarse cuando el plan contratado permita rotación.",
    ],
  },
  {
    titulo: "Comisiones y contratos",
    condiciones: [
      "Las condiciones de comisión deberán acordarse por escrito.",
      "El pago del Plan Contenido Profesional no garantiza la venta del inmueble.",
      "Los términos específicos de cada operación estarán sujetos al contrato firmado entre las partes.",
    ],
  },
];

// Número con el que arranca cada sección (numeración continua).
const inicios = secciones.reduce<number[]>((acc, s, i) => {
  acc.push(i === 0 ? 1 : acc[i - 1] + secciones[i - 1].condiciones.length);
  return acc;
}, []);

export default function CondicionesPage() {
  return (
    <>
      <div className="wrap pt-8">
        <Link href="/publica/agente" className="link-arrow py-2 text-[15px]">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Volver a los planes
        </Link>
      </div>

      <header className="wrap pb-10 pt-8 sm:pb-14 sm:pt-12">
        <h1 className="t-display max-w-4xl">Condiciones de publicación.</h1>
        <p className="t-lead mt-5 max-w-2xl">
          Aplican a la publicación de inmuebles en CIC Inmuebles para agentes, inmobiliarias y propietarios.
        </p>
      </header>

      <div className="wrap max-w-[56rem] pb-28">
        {secciones.map((s, idx) => {
          const inicio = inicios[idx];
          return (
            <section key={s.titulo} className="mt-14 first:mt-0" aria-labelledby={`cond-${inicio}`}>
              <h2 id={`cond-${inicio}`} className="t-title">{s.titulo}</h2>
              <ol start={inicio} className="mt-5">
                {s.condiciones.map((c, i) => (
                  <li key={c} className="grid grid-cols-[2.75rem_1fr] gap-x-2 border-t border-line py-4 text-[15px] leading-relaxed text-ink-soft">
                    <span className="tnum text-muted">{inicio + i}.</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ol>
            </section>
          );
        })}

        <p className="mt-14 text-[15px] text-muted">
          ¿Dudas sobre las condiciones?{" "}
          <Link href="/contacto" className="font-medium text-brand-700 underline underline-offset-4">Escríbenos</Link>.
        </p>
      </div>
    </>
  );
}
