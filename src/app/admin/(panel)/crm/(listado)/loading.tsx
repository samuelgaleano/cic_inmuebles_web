import { EsqueletoListado } from "@/components/admin/esqueleto-listado";

// Vive en el grupo (listado) y no en crm/: así no envuelve la ficha del contacto, que con un loading encima
// respondería 200 en vez de 404 cuando el contacto no existe (notFound() después de empezar a transmitir).
export default function Loading() {
  return <EsqueletoListado titulo="CRM" />;
}
