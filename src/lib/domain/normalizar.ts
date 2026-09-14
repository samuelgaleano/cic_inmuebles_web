import { formatLugar, formatNombre } from "@/lib/utils/lugar";

/**
 * Formato único del catálogo. El inventario se escribe a mano en varios sitios
 * (carpetas y fichas de Drive, panel admin) y llega con errores de digitación:
 * "BogotÁ", "BELLA SUIZA", espacios dobles. Esos textos terminan en el
 * <title>, el H1 y el JSON-LD de cada ficha, o sea, en Google.
 *
 * Se aplica en tres puntos para que dé igual dónde se escribió mal:
 *   - al importar desde Drive (drive-import),
 *   - al crear o editar desde el panel (mappers de Supabase y repo en memoria),
 *   - al leer de la base (mapper de fila → dominio), que cubre lo ya guardado.
 * El Sheet se regenera desde la base, así que hereda la corrección.
 */

interface UbicacionLibre {
  ciudad: string;
  sector?: string | null;
  conjunto?: string | null;
  direccion?: string | null;
}

interface InmuebleLibre {
  titulo: string;
  ubicacion: UbicacionLibre;
  descripcion?: string | null;
}

const oNada = (v: string | undefined): string | undefined => (v ? v : undefined);

export function normalizarInmueble<T extends InmuebleLibre>(p: T): T {
  return {
    ...p,
    titulo: formatNombre(p.titulo) ?? "",
    ubicacion: {
      ...p.ubicacion,
      ciudad: formatLugar(p.ubicacion.ciudad) ?? "",
      sector: oNada(formatLugar(p.ubicacion.sector)),
      conjunto: oNada(formatNombre(p.ubicacion.conjunto)),
      direccion: oNada(p.ubicacion.direccion?.trim().replace(/\s+/g, " ")),
    },
    descripcion: p.descripcion == null ? p.descripcion : p.descripcion.trim(),
  };
}
