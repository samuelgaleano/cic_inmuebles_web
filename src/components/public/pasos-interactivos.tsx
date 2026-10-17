"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, MessageCircle } from "lucide-react";
import { SafeImage } from "@/components/ui/safe-image";
import { buttonVariants } from "@/components/ui/button";
import { siteConfig, whatsappLink } from "@/lib/config/site";
import { componerPreferencia, FRANJAS, proximosDias, type DiaVisita, type FranjaId } from "@/lib/ficha/visitas";
import type { ItemIndice } from "@/lib/search/indice";
import type { ContextoBusqueda } from "@/lib/search/interpretar";
import { buscar, ESTADO_VACIO } from "@/lib/search/motor";
import { aQuery } from "@/lib/search/url";
import { cn } from "@/lib/utils/cn";
import { formatPriceCompact } from "@/lib/utils/format";

const DURACION = 8000;

const PASOS = [
  {
    t: "Cuéntanos qué buscas",
    d: "Escribe una frase con tus palabras: zona, alcobas, presupuesto. El catálogo la entiende y te dice por qué aparece cada inmueble.",
  },
  {
    t: "Elige tu día",
    d: "Marca el día y la franja que te sirven. Un asesor te confirma la visita por WhatsApp.",
  },
  {
    t: "Te acompañamos hasta las llaves",
    d: "Negociación y papeleo, de principio a fin, con respuesta directa y sin intermediarios.",
  },
];

/**
 * «Del primer mensaje a las llaves» como recorrido que se puede tocar: cada paso
 * abre una demostración que funciona (buscar con una frase, elegir día y franja,
 * ver el camino hasta las llaves). Avanza solo una vez, se detiene al pasar el
 * cursor o al interactuar, y con «reducir movimiento» no se mueve sola.
 */
export function PasosInteractivos({
  indice,
  ctx,
  sugerencias,
}: {
  indice: ItemIndice[];
  ctx: ContextoBusqueda;
  sugerencias: string[];
}) {
  const [activo, setActivo] = useState(0);
  const [auto, setAuto] = useState(true);
  const botones = useRef<(HTMLButtonElement | null)[]>([]);
  // Ids únicos por instancia (useId): dos recorridos en la misma página no chocarían.
  const base = useId();
  const idPaso = (i: number) => `${base}-paso-${i}`;
  const idPanel = `${base}-panel`;

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const id = setTimeout(() => setAuto(false), 0);
      return () => clearTimeout(id);
    }
  }, []);

  const elegir = (i: number, enfocar = false) => {
    setActivo(i);
    setAuto(false);
    if (enfocar) botones.current[i]?.focus();
  };

  const alTeclear = (e: React.KeyboardEvent, i: number) => {
    const ultimo = PASOS.length - 1;
    const destino =
      e.key === "ArrowDown" || e.key === "ArrowRight" ? (i === ultimo ? 0 : i + 1)
      : e.key === "ArrowUp" || e.key === "ArrowLeft" ? (i === 0 ? ultimo : i - 1)
      : e.key === "Home" ? 0
      : e.key === "End" ? ultimo
      : null;
    if (destino === null) return;
    e.preventDefault();
    elegir(destino, true);
  };

  return (
    <div className="pasos mt-12 grid gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-14">
      <div role="tablist" aria-label="Pasos del proceso" aria-orientation="vertical" className="flex flex-col gap-2">
        {PASOS.map((p, i) => {
          const sel = activo === i;
          return (
            <button
              key={p.t}
              ref={(el) => {
                botones.current[i] = el;
              }}
              type="button"
              role="tab"
              id={idPaso(i)}
              aria-selected={sel}
              aria-controls={idPanel}
              tabIndex={sel ? 0 : -1}
              onClick={() => elegir(i)}
              onKeyDown={(e) => alTeclear(e, i)}
              className={cn(
                "grid w-full grid-cols-[2.5rem_1fr] gap-4 rounded-[1.25rem] p-4 text-left transition-colors duration-300 sm:p-5",
                sel ? "bg-surface" : "hover:bg-surface/70",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex h-10 w-10 items-center justify-center rounded-full text-[15px] font-semibold transition-colors duration-300",
                  sel ? "bg-brand-700 text-white" : i < activo ? "bg-brand-100 text-brand-800" : "bg-ink/[0.07] text-ink",
                )}
              >
                {i < activo ? <Check className="h-4 w-4" aria-hidden /> : i + 1}
              </span>
              <span className="min-w-0">
                <span className={cn("block text-[1.25rem] font-semibold leading-snug tracking-[-0.02em] sm:text-[1.5rem]", !sel && "text-ink-soft")}>
                  {p.t}
                </span>
                <span
                  className={cn(
                    "grid transition-[grid-template-rows,opacity] duration-500 ease-[var(--ease-fluid)]",
                    sel ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                  )}
                >
                  <span className="overflow-hidden">
                    <span className="mt-2 block max-w-md text-[1rem] leading-relaxed text-muted">{p.d}</span>
                    <span className="mt-4 block h-[3px] overflow-hidden rounded-full bg-ink/10">
                      {sel &&
                        (auto ? (
                          <span
                            key={`${activo}-auto`}
                            className="paso-progreso block h-full rounded-full bg-brand-600"
                            style={{ "--dur": `${DURACION}ms` } as React.CSSProperties}
                            onAnimationEnd={() => (activo < PASOS.length - 1 ? setActivo(activo + 1) : setAuto(false))}
                          />
                        ) : (
                          <span className="block h-full w-full rounded-full bg-brand-600" />
                        ))}
                    </span>
                  </span>
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={idPanel}
        aria-labelledby={idPaso(activo)}
        onPointerDown={() => setAuto(false)}
        onKeyDown={() => setAuto(false)}
        className="min-h-[26rem] min-w-0 overflow-hidden rounded-[var(--radius-tile)] bg-ink p-6 text-white sm:p-9"
      >
        <div key={activo} className="anim-panel">
          {activo === 0 && <PasoBuscar indice={indice} ctx={ctx} sugerencias={sugerencias} />}
          {activo === 1 && <PasoDia />}
          {activo === 2 && <PasoLlaves total={indice.length} />}
        </div>
      </div>
    </div>
  );
}

/* ───────────── Paso 1: escribir una frase y ver lo que entiende el catálogo ───────────── */
function PasoBuscar({ indice, ctx, sugerencias }: { indice: ItemIndice[]; ctx: ContextoBusqueda; sugerencias: string[] }) {
  const router = useRouter();
  const idFrase = useId();
  const [texto, setTexto] = useState("");
  const tocado = useRef(false);
  // El texto que se escribe solo cambia los resultados letra por letra: si eso se anunciara, el lector de
  // pantalla recitaría la demostración sin que nadie la pidiera. Solo se anuncia tras la primera interacción.
  const [interactuo, setInteractuo] = useState(false);
  const tocar = () => {
    tocado.current = true;
    setInteractuo(true);
  };

  // Escribe sola la primera sugerencia (hasta que la persona toque el campo).
  useEffect(() => {
    const frase = sugerencias[0];
    if (!frase) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const id = setTimeout(() => setTexto(frase), 0);
      return () => clearTimeout(id);
    }
    let n = 0;
    const id = setInterval(() => {
      if (tocado.current) return clearInterval(id);
      n += 1;
      setTexto(frase.slice(0, n));
      if (n >= frase.length) clearInterval(id);
    }, 42);
    return () => clearInterval(id);
  }, [sugerencias]);

  const b = useMemo(() => buscar(indice, { ...ESTADO_VACIO, texto }, ctx), [indice, ctx, texto]);
  const hay = texto.trim().length >= 2;
  const destino = `/inmuebles${aQuery({ ...ESTADO_VACIO, texto })}`;

  return (
    <div>
      <p className="text-[15px] text-white/70">Escribe lo que buscas, como se lo dirías a un asesor:</p>
      <form
        className="mt-3 flex items-center gap-2 rounded-full bg-white p-1.5 pl-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (hay) router.push(destino);
        }}
      >
        <label htmlFor={idFrase} className="sr-only">
          Tu búsqueda
        </label>
        <input
          id={idFrase}
          value={texto}
          onChange={(e) => {
            tocar();
            setTexto(e.target.value);
          }}
          onFocus={() => {
            tocado.current = true; // detiene la demostración, pero no activa los anuncios hasta que escriba
          }}
          placeholder="3 alcobas en Bella Suiza hasta 900 millones"
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent py-2.5 text-[16px] text-ink outline-none placeholder:text-muted"
        />
        <button
          type="submit"
          disabled={!hay}
          aria-label="Buscar en el catálogo"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-700 text-white transition-colors hover:bg-brand-800 disabled:opacity-40"
        >
          <ArrowRight className="h-5 w-5" aria-hidden />
        </button>
      </form>

      {sugerencias.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2" aria-label="Ejemplos">
          {sugerencias.slice(0, 3).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                tocar();
                setTexto(s);
              }}
              className="rounded-full bg-white/10 px-3.5 py-1.5 text-[14px] text-white transition-colors hover:bg-white/20"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Región viva aparte y siempre montada (vacía hasta que la persona interactúa), para que el primer
          cambio tras interactuar sí se anuncie. */}
      <p className="sr-only" aria-live="polite">
        {interactuo && hay
          ? b.resultados.length > 0
            ? `${b.resultados.length === 1 ? "1 resultado" : `${b.resultados.length} resultados`}${
                b.interpretacion.chips.length > 0 ? `. Entendí: ${b.interpretacion.chips.map((c) => c.etiqueta).join(", ")}` : ""
              }.`
            : "Con esa frase no hay coincidencias exactas."
          : ""}
      </p>
      <div className="mt-6 min-h-[9.5rem]">
        {hay && b.interpretacion.chips.length > 0 && (
          <>
            <p className="text-[13px] text-white/60">Esto es lo que entendí</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {b.interpretacion.chips.map((c) => (
                <li key={c.id} className="rounded-full bg-brand-500 px-3.5 py-1 text-[14px] font-medium text-ink">
                  {c.etiqueta}
                </li>
              ))}
            </ul>
          </>
        )}
        {hay && b.resultados.length > 0 && (
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {b.resultados.slice(0, 2).map(({ item, razones }) => (
              <li key={item.slug}>
                <Link
                  href={`/inmuebles/${item.slug}`}
                  className="group flex items-center gap-3 rounded-2xl bg-white p-2.5 pr-4 text-ink transition-transform duration-200 hover:-translate-y-0.5"
                >
                  <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-surface">
                    {item.portada && <SafeImage src={item.portada} alt="" fill sizes="56px" className="object-cover" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-semibold">{item.titulo}</span>
                    <span className="tnum block truncate text-[13px] text-muted">{formatPriceCompact(item.precio)}</span>
                    {razones[0] && <span className="block truncate text-[12px] text-brand-800">{razones[0]}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {hay && b.resultados.length === 0 && (
          <p className="mt-4 text-[15px] text-white/75">Con esa frase no hay coincidencias exactas; prueba con otras palabras o escríbenos.</p>
        )}
        {!hay && <p className="text-[15px] text-white/60">Empieza a escribir y verás aquí qué entiende el catálogo.</p>}
      </div>

      {hay && (
        <Link href={destino} className={cn(buttonVariants({ variant: "inverse", size: "md" }), "mt-2")}>
          Ver {b.resultados.length === 1 ? "el resultado" : `los ${b.resultados.length} resultados`}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      )}
    </div>
  );
}

/* ───────────── Paso 2: elegir día y franja y pedir la visita por WhatsApp ───────────── */
function PasoDia() {
  const [dias, setDias] = useState<DiaVisita[]>([]);
  const [dia, setDia] = useState<DiaVisita | undefined>();
  const [franja, setFranja] = useState<FranjaId | undefined>();

  // Los días se calculan en el navegador (zona de Bogotá) para no desfasar el servidor.
  useEffect(() => {
    const id = setTimeout(() => setDias(proximosDias(new Date(), 7)), 0);
    return () => clearTimeout(id);
  }, []);

  const preferencia = componerPreferencia(dia, franja);
  const mensaje = preferencia
    ? `Hola ${siteConfig.name}, me gustaría visitar un inmueble ${preferencia}. ¿Qué opciones me recomiendan?`
    : `Hola ${siteConfig.name}, me gustaría agendar la visita de un inmueble. ¿Qué días tienen disponibles?`;

  return (
    <div>
      <p className="text-[15px] text-white/70">Elige el día que te sirve:</p>
      <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-7" role="group" aria-label="Día de la visita">
        {(dias.length > 0 ? dias : Array.from({ length: 7 }, () => null)).map((d, i) =>
          d ? (
            <button
              key={d.iso}
              type="button"
              aria-pressed={dia?.iso === d.iso}
              onClick={() => setDia(d)}
              className={cn(
                "flex flex-col items-center rounded-2xl px-1 py-3 text-center transition-colors duration-200",
                dia?.iso === d.iso ? "bg-brand-500 text-ink" : "bg-white/10 text-white hover:bg-white/20",
              )}
            >
              <span className="text-[12px] capitalize opacity-80">{d.corto}</span>
              <span className="tnum text-[1.5rem] font-semibold leading-none">{d.dia}</span>
              <span className="text-[12px] capitalize opacity-80">{d.mes}</span>
            </button>
          ) : (
            <span key={i} className="h-[5.25rem] rounded-2xl bg-white/[0.06]" aria-hidden />
          ),
        )}
      </div>

      <p className="mt-6 text-[15px] text-white/70">Y la franja:</p>
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Franja de la visita">
        {FRANJAS.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={franja === f.id}
            onClick={() => setFranja(f.id)}
            className={cn(
              "rounded-full px-5 py-2.5 text-[15px] font-medium transition-colors duration-200",
              franja === f.id ? "bg-brand-500 text-ink" : "bg-white/10 text-white hover:bg-white/20",
            )}
          >
            {f.etiqueta}
          </button>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
        <a
          href={whatsappLink(mensaje)}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: "whatsapp", size: "lg" })}
        >
          <MessageCircle className="h-4 w-4" aria-hidden />
          {preferencia ? "Pedir esta visita" : "Preguntar por WhatsApp"}
        </a>
        <p className="min-w-0 flex-1 text-[14px] leading-snug text-white/65" aria-live="polite">
          {preferencia ? <>Tu preferencia: <span className="text-white">{preferencia}</span>. </> : null}
          Un asesor te confirma por WhatsApp; no es una reserva.
        </p>
      </div>
    </div>
  );
}

/* ───────────── Paso 3: el camino hasta las llaves ───────────── */
function PasoLlaves({ total }: { total: number }) {
  const hitos = [
    { t: "Visitas el inmueble", d: total > 0 ? "Entre los inmuebles visitados y verificados por CIC." : "Con un asesor de CIC." },
    { t: "Negociamos contigo", d: "Respuesta directa por WhatsApp, sin intermediarios." },
    { t: "Papeleo, de principio a fin", d: "Te acompañamos en cada trámite." },
    { t: "Recibes las llaves", d: "Y si vendes, solo pagas cuando se cierra la venta." },
  ];
  return (
    <div>
      <ol className="relative ml-1 border-l border-white/20">
        {hitos.map((h, i) => (
          <li key={h.t} className="anim-hito relative pb-6 pl-8 last:pb-0" style={{ "--d": `${i * 160}ms` } as React.CSSProperties}>
            <span
              aria-hidden
              className={cn(
                "absolute -left-[13px] top-0 flex h-[26px] w-[26px] items-center justify-center rounded-full",
                i === hitos.length - 1 ? "bg-brand-500 text-ink" : "bg-white text-ink",
              )}
            >
              <Check className="h-3.5 w-3.5" />
            </span>
            <p className="text-[1.125rem] font-semibold leading-snug tracking-[-0.01em]">{h.t}</p>
            <p className="mt-0.5 text-[15px] text-white/70">{h.d}</p>
          </li>
        ))}
      </ol>
      <div className="mt-8 flex flex-wrap gap-3">
        <a
          href={whatsappLink(`Hola ${siteConfig.name}, quiero que me acompañen con un inmueble. ¿Podemos hablar?`)}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: "whatsapp", size: "lg" })}
        >
          <MessageCircle className="h-4 w-4" aria-hidden />
          Hablar con un asesor
        </a>
        <Link href="/inmuebles" className={buttonVariants({ variant: "inverse", size: "lg" })}>
          Ver los inmuebles
        </Link>
      </div>
    </div>
  );
}
