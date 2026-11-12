import type { Metadata } from "next";
import { cargarRenovacion, METADATA_PLANES, VistaPlanes } from "../_vista";

// Enlace firmado del correo de vencimiento: abre el plan que vence con los datos precargados. Es personal.
export const metadata: Metadata = {
  ...METADATA_PLANES,
  robots: { index: false, follow: false },
  alternates: { canonical: "/publica/agente" },
};

export default async function RenovarPage({ searchParams }: { searchParams: Promise<{ renovar?: string }> }) {
  const { renovar } = await searchParams;
  return <VistaPlanes renovacion={await cargarRenovacion(renovar)} />;
}
