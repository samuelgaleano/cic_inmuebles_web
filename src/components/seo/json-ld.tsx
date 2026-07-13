/**
 * Marcado schema.org embebido como <script type="application/ld+json">.
 * Escapa "<" para evitar inyección de HTML/cierre de script con datos
 * provenientes de la base (títulos, descripciones).
 */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
