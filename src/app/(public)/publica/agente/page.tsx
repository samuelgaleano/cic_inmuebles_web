import { METADATA_PLANES, VistaPlanes } from "./_vista";

// Página estática (ISR): NO lee `searchParams`. Antes cada visita a los planes ejecutaba una función con una
// consulta a Supabase. El retorno del pago vive en /publica/agente/pago y la renovación en /publica/agente/renovar
// (ambas dinámicas); los enlaces antiguos con ?pago= / ?renovar= se redirigen desde next.config.ts.
export const revalidate = 21600;

export const metadata = METADATA_PLANES;

export default function AgentePlanesPage() {
  return <VistaPlanes />;
}
