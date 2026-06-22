import { MapPin } from "lucide-react";

/**
 * Mapa de ubicación con OpenStreetMap embebido (gratuito, sin API key ni
 * dependencias). Se muestra solo si hay coordenadas. Por privacidad mostramos
 * la zona aproximada (no la dirección exacta).
 */
export function PropertyMap({
  lat,
  lng,
  label,
}: {
  lat?: number;
  lng?: number;
  label: string;
}) {
  if (lat == null || lng == null) return null;

  const d = 0.008; // ~800 m de margen para mostrar la zona, no el punto exacto
  const bbox = `${lng - d}%2C${lat - d}%2C${lng + d}%2C${lat + d}`;
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`;
  const link = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=15/${lat}/${lng}`;

  return (
    <section className="mt-10">
      <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight text-ink">
        <MapPin className="h-5 w-5 text-brand-600" /> Ubicación
      </h2>
      <p className="mt-1 text-sm text-muted">Zona aproximada del inmueble.</p>
      <div className="mt-3 overflow-hidden rounded-[1.4rem] border border-line">
        <iframe
          title={`Mapa de ${label}`}
          src={src}
          loading="lazy"
          className="h-72 w-full"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-block text-sm font-medium text-brand-700 hover:underline"
      >
        Ver en mapa más grande
      </a>
    </section>
  );
}
