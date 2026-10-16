import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/lib/config/site";

export const metadata: Metadata = {
  title: "Política de tratamiento de datos personales",
  description:
    "Cómo CIC Inmuebles recoge, usa y protege tus datos personales, quién interviene en su tratamiento y cómo ejercer tus derechos (Ley 1581 de 2012).",
  alternates: { canonical: "/privacidad" },
};

const ACTUALIZADA = "16 de octubre de 2026";

type Seccion = { titulo: string; cuerpo: React.ReactNode };

const lista = "mt-3 list-disc space-y-2 pl-5 marker:text-muted";

const secciones: Seccion[] = [
  {
    titulo: "Quién es el responsable",
    cuerpo: (
      <p>
        {siteConfig.name}, con domicilio en {siteConfig.city}, Colombia, es el responsable del tratamiento de los datos que se
        recogen en este sitio. Puedes escribirnos a{" "}
        <a href={`mailto:${siteConfig.email}`} className="font-medium text-brand-700 underline underline-offset-4">{siteConfig.email}</a>{" "}
        o por WhatsApp al <span className="tnum">{siteConfig.phoneDisplay}</span>.
      </p>
    ),
  },
  {
    titulo: "Qué datos recogemos y para qué",
    cuerpo: (
      <>
        <p>Solo recogemos lo que escribes tú en los formularios y lo que genera el funcionamiento normal del sitio.</p>
        <ul className={lista}>
          <li>
            <strong className="font-medium text-ink">Formularios de contacto, venta y visita:</strong> nombre y teléfono; opcionalmente correo,
            ciudad, tipo de inmueble, preferencia de día y franja de visita, y el mensaje que escribas. Los usamos para atender tu solicitud
            y contactarte por WhatsApp, llamada o correo.
          </li>
          <li>
            <strong className="font-medium text-ink">Contratación de un plan de publicación:</strong> nombre, correo y teléfono. Los usamos para
            prellenar la pasarela de pago, confirmar tu pago, contactarte después de pagar, identificar tu publicación y avisarte de su vigencia.
          </li>
          <li>
            <strong className="font-medium text-ink">Pagos:</strong> la referencia de la transacción, su estado, el monto y el correo del comprador
            que nos informa la pasarela.
          </li>
          <li>
            <strong className="font-medium text-ink">Datos técnicos de conexión:</strong> como cualquier sitio web, el servicio de alojamiento
            registra datos como la dirección IP y el navegador para que el sitio funcione y se mantenga seguro.
          </li>
          <li>
            <strong className="font-medium text-ink">Favoritos y comparación:</strong> se guardan solo en tu navegador, en tu dispositivo, no en
            nuestros servidores. Puedes borrarlos cuando quieras desde el propio sitio o limpiando los datos del navegador.
          </li>
        </ul>
        <p className="mt-3">No solicitamos datos sensibles ni datos de menores de edad.</p>
      </>
    ),
  },
  {
    titulo: "Datos de pago",
    cuerpo: (
      <p>
        Los pagos con tarjeta, PSE o Nequi los procesa Wompi en su propia pasarela. {siteConfig.name} no recibe ni guarda números de tarjeta,
        claves ni datos bancarios: solo conoce el resultado de la transacción (aprobada, rechazada u otro estado), su monto y la referencia.
      </p>
    ),
  },
  {
    titulo: "Quién más interviene",
    cuerpo: (
      <>
        <p>Para prestar el servicio usamos proveedores que pueden tratar datos por nuestra cuenta:</p>
        <ul className={lista}>
          <li>Supabase: base de datos donde se guardan las solicitudes y el registro de pagos.</li>
          <li>Vercel: alojamiento del sitio.</li>
          <li>Resend: envío de correos (el aviso interno de una solicitud o de un pago y, en los planes de publicación, los avisos de vigencia).</li>
          <li>Wompi: pasarela de pagos.</li>
          <li>Google Drive y Google Sheets: allí administramos el inventario de inmuebles; no se usan para guardar datos de visitantes.</li>
          <li>Cloudinary: entrega de las fotografías de los inmuebles.</li>
          <li>
            WhatsApp (Meta): al tocar un botón de WhatsApp se abre la aplicación con tu mensaje; desde ahí rigen las políticas de WhatsApp.
          </li>
          <li>YouTube: los videos de las fichas se cargan en modo de privacidad ampliada y solo cuando das «play».</li>
        </ul>
        <p className="mt-3">Cada proveedor aplica además su propia política de privacidad.</p>
      </>
    ),
  },
  {
    titulo: "Cuánto tiempo los conservamos",
    cuerpo: (
      <p>
        El contenido completo de las notificaciones de pago (que incluye el correo del comprador) se elimina automáticamente a las 72 horas.
        Los demás datos los conservamos mientras sean necesarios para atender tu solicitud, mantener la relación comercial y cumplir
        obligaciones legales; cuando lo pidas y no haya un deber de conservarlos, los suprimimos.
      </p>
    ),
  },
  {
    titulo: "Tus derechos",
    cuerpo: (
      <>
        <p>De acuerdo con la Ley 1581 de 2012 y el Decreto 1377 de 2013, como titular de los datos puedes:</p>
        <ul className={lista}>
          <li>Conocer, actualizar y rectificar tus datos personales.</li>
          <li>Solicitar prueba de la autorización que nos diste.</li>
          <li>Ser informado del uso que se ha dado a tus datos.</li>
          <li>Revocar la autorización y solicitar la supresión de tus datos cuando no se respeten los principios y garantías legales.</li>
          <li>Presentar quejas ante la Superintendencia de Industria y Comercio (SIC) por infracciones a la ley.</li>
          <li>Acceder de forma gratuita a tus datos personales.</li>
        </ul>
      </>
    ),
  },
  {
    titulo: "Cómo ejercer tus derechos",
    cuerpo: (
      <>
        <p>
          Escríbenos a{" "}
          <a href={`mailto:${siteConfig.email}`} className="font-medium text-brand-700 underline underline-offset-4">{siteConfig.email}</a>{" "}
          indicando tu nombre, el teléfono o correo con el que te registraste y lo que solicitas.
        </p>
        <ul className={lista}>
          <li>Las consultas se responden en un máximo de 10 días hábiles, prorrogables por 5 días hábiles más si te explicamos el motivo.</li>
          <li>Los reclamos (corrección, actualización o supresión) se responden en un máximo de 15 días hábiles, prorrogables por 8 días hábiles más.</li>
        </ul>
      </>
    ),
  },
  {
    titulo: "Autorización y cambios",
    cuerpo: (
      <p>
        Al enviar un formulario o contratar un plan autorizas el tratamiento de tus datos en los términos de esta política. Si la modificamos,
        publicaremos la nueva versión en esta página con su fecha de actualización.
      </p>
    ),
  },
];

export default function PrivacidadPage() {
  return (
    <>
      <header className="wrap pb-10 pt-12 sm:pb-14 sm:pt-20">
        <h1 className="t-display max-w-4xl">Política de tratamiento de datos personales.</h1>
        <p className="t-lead mt-5 max-w-2xl">
          Qué datos recogemos, para qué los usamos, quién interviene y cómo puedes ejercer tus derechos.
        </p>
        <p className="mt-4 text-[14px] text-muted">Última actualización: {ACTUALIZADA}</p>
      </header>

      <div className="wrap max-w-[56rem] pb-28">
        {secciones.map((s, i) => (
          <section key={s.titulo} aria-labelledby={`priv-${i}`} className="mt-12 first:mt-0">
            <h2 id={`priv-${i}`} className="t-title">{s.titulo}</h2>
            <div className="mt-4 space-y-3 text-[15px] leading-relaxed text-ink-soft">{s.cuerpo}</div>
          </section>
        ))}

        <p className="mt-14 text-[15px] text-muted">
          ¿Dudas sobre esta política?{" "}
          <Link href="/contacto" className="font-medium text-brand-700 underline underline-offset-4">Escríbenos</Link>.
        </p>
      </div>
    </>
  );
}
