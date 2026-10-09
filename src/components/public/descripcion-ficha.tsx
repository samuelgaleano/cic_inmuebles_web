import type { DescripcionOrdenada } from "@/lib/ficha/descripcion";

/**
 * La descripción de la ficha ya ordenada (sin emojis ni plantillas, sin datos
 * repetidos): una frase de apertura, párrafos y listas con subtítulo.
 */
export function DescripcionFicha({ d }: { d: DescripcionOrdenada }) {
  // Las líneas sueltas separadas por saltos de línea forman UNA lista; solo un subtítulo abre otra.
  const grupos = d.grupos
    .filter((g) => g.items.length > 0)
    .reduce<{ titulo?: string; items: string[] }[]>((acc, g) => {
      const previo = acc[acc.length - 1];
      if (previo && !previo.titulo && !g.titulo) previo.items.push(...g.items);
      else acc.push({ titulo: g.titulo, items: [...g.items] });
      return acc;
    }, []);
  if (!d.titular && d.parrafos.length === 0 && grupos.length === 0) return null;

  return (
    <section aria-labelledby="descripcion-titulo">
      <h2 id="descripcion-titulo" className="t-title">Sobre este inmueble</h2>

      {d.titular && <p className="mt-6 max-w-2xl text-[1.375rem] font-medium leading-snug tracking-[-0.015em]">{d.titular}</p>}

      {d.parrafos.map((p, i) => (
        <p key={i} className="mt-4 max-w-2xl leading-relaxed text-ink-soft">{p}</p>
      ))}

      {grupos.map((g, i) => (
        <div key={i} className="mt-10">
          {g.titulo && <h3 className="text-[1.0625rem] font-semibold tracking-[-0.01em]">{g.titulo}</h3>}
          <ul className="mt-3 grid gap-x-10 sm:grid-cols-2">
            {g.items.map((item, j) => (
              <li key={j} className="border-t border-line py-3 text-[15px] leading-snug text-ink-soft">{item}</li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
