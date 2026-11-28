import type { Metadata } from "next";
import { MessageCircle } from "lucide-react";
import { DatosInmuebleForm } from "@/components/public/datos-inmueble-form";
import { buttonVariants } from "@/components/ui/button";
import { getPlan } from "@/lib/config/plans";
import { whatsappLink } from "@/lib/config/site";
import { getServiciosStore } from "@/lib/servicios/store";
import { servicioDeTokenDeDatos } from "@/lib/servicios/token";

// Enlace firmado del correo de confirmación del pago: es personal, se resuelve en cada visita y no se indexa.
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Datos de tu inmueble",
  robots: { index: false, follow: false },
  alternates: { canonical: "/publica/agente" },
};

/** Plan del servicio del enlace, o null si el enlace no sirve (firma ajena, vencido, servicio descartado). */
async function planDelEnlace(token: string | undefined): Promise<{ nombre: string; espacios?: number } | null> {
  if (typeof token !== "string") return null;
  const servicioId = servicioDeTokenDeDatos(token);
  if (!servicioId) return null;
  try {
    const s = await getServiciosStore().obtener(servicioId);
    const plan = s ? getPlan(s.planId) : undefined;
    if (!s || s.estado === "descartado" || !plan) return null;
    return { nombre: plan.nombre, espacios: plan.espacios };
  } catch {
    return null;
  }
}

export default async function DatosInmueblePage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  const plan = await planDelEnlace(t);

  return (
    <div className="wrap max-w-2xl pb-28 pt-12 sm:pt-16">
      <p className="text-[15px] text-muted">Después del pago</p>
      <h1 className="t-display mt-2">Datos de tu inmueble</h1>

      {plan && t ? (
        <>
          <p className="t-lead mt-5">
            Con esto armamos la ficha de tu plan «{plan.nombre}». Las fotos nos las envías por WhatsApp. La vigencia empieza a contar el día en que
            publicamos, no hoy.
            {plan.espacios ? ` Tu paquete cubre hasta ${plan.espacios} inmuebles: envía este formulario una vez por cada uno.` : ""}
          </p>
          <div className="mt-10">
            <DatosInmuebleForm token={t} />
          </div>
        </>
      ) : (
        <div role="status" className="mt-8 rounded-[var(--radius-card)] bg-surface p-6">
          <p className="text-[1.0625rem] font-semibold">Este enlace ya no es válido o venció.</p>
          <p className="mt-1 text-[15px] text-muted">Escríbenos por WhatsApp y te ayudamos a publicar tu inmueble.</p>
          <a
            href={whatsappLink("Hola, ya pagué mi plan y quiero enviar los datos de mi inmueble.")}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "whatsapp", size: "lg", className: "mt-5" })}
          >
            <MessageCircle className="h-5 w-5" aria-hidden /> Escribir por WhatsApp
          </a>
        </div>
      )}
    </div>
  );
}
