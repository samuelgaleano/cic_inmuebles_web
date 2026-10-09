/**
 * Ordena la descripción de una ficha. En el catálogo, la descripción llega
 * como texto de WhatsApp: emojis, "Ficha Técnica", y datos (precio, área,
 * habitaciones…) que la ficha ya muestra en sus campos estructurados. Mostrarla
 * tal cual se ve improvisado y puede contradecir los datos reales.
 *
 * Esta función NO inventa nada ni pierde líneas sin motivo:
 *   - quita emojis y la plantilla ("Ficha Técnica del Apartamento");
 *   - descarta SOLO lo que ya está en los campos estructurados, y si la cifra
 *     del texto contradice al campo, gana el campo y lo reporta en `conflictos`
 *     (para que el equipo corrija el dato de origen);
 *   - rescata datos que la ficha no tiene (estrato, área privada…);
 *   - organiza el resto en titular, listas con subtítulo y párrafos.
 */

export interface DatosEstructurados {
  precio?: number;
  administracion?: number;
  area?: number;
  habitaciones?: number;
  banos?: number;
  parqueaderos?: number;
}

export interface DescripcionOrdenada {
  titular?: string;
  grupos: { titulo?: string; items: string[] }[];
  parrafos: string[];
  datos: { etiqueta: string; valor: string }[];
  /** Campos cuyo valor en el texto contradice la ficha (el texto se descarta). */
  conflictos: string[];
}

type Campo = "precio" | "administración" | "área" | "habitaciones" | "baños" | "parqueaderos";

const EMOJI = /[\p{Extended_Pictographic}️‍⃣]/gu;

function limpiar(linea: string): string {
  return linea
    .replace(EMOJI, " ")
    .replace(/^[\s•·▪▫◦*\-–—]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

const esSeparador = (l: string) => /^[\s⸻_\-–—=·•.]{3,}$/.test(l);

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

/** Primer número de un texto: "$1.420.000.000" → 1420000000 · "136.22 m²" → 136.22. */
function primerNumero(s: string, dinero: boolean): number | undefined {
  const m = s.match(/\d[\d.,]*/);
  if (!m) return undefined;
  const crudo = m[0].replace(/[.,]+$/, "");
  if (dinero || /^\d{1,3}(?:[.,]\d{3})+$/.test(crudo)) return Number(crudo.replace(/[.,]/g, ""));
  if (/^\d+[.,]\d+$/.test(crudo)) return Number(crudo.replace(",", "."));
  return Number(crudo);
}

const CLAVES: { campo: Campo; re: RegExp; dinero: boolean }[] = [
  { campo: "precio", re: /^(valor|precio|precio de venta|valor de venta|precio venta)$/, dinero: true },
  { campo: "administración", re: /^(administracion|valor administracion|valor de la administracion|cuota de administracion)$/, dinero: true },
  { campo: "área", re: /^(area|area construida|area total|area util|metraje)$/, dinero: false },
  { campo: "habitaciones", re: /^(habitaciones|habitacion|alcobas|cuartos|dormitorios)$/, dinero: false },
  { campo: "baños", re: /^(banos|bano)$/, dinero: false },
  { campo: "parqueaderos", re: /^(parqueadero|parqueaderos|garaje|garajes)$/, dinero: false },
];

const CONTEO = /^(\d+)\s+(habitaciones?|alcobas?|cuartos?|dormitorios?|banos?|parqueaderos?|garajes?)\b[,;]?\s*(.*)$/i;

function campoDeSustantivo(s: string): Campo {
  const n = norm(s);
  if (/^(habitacion|alcoba|cuarto|dormitorio)/.test(n)) return "habitaciones";
  if (/^bano/.test(n)) return "baños";
  return "parqueaderos";
}

function acuerdo(campo: Campo, texto: number, ficha: number): boolean {
  if (campo === "área") return Math.abs(texto - ficha) / ficha <= 0.03;
  return texto === ficha;
}

function valorFicha(campo: Campo, d: DatosEstructurados): number | undefined {
  switch (campo) {
    case "precio": return d.precio;
    case "administración": return d.administracion;
    case "área": return d.area;
    case "habitaciones": return d.habitaciones;
    case "baños": return d.banos;
    case "parqueaderos": return d.parqueaderos;
  }
}

const mayus1 = (s: string) => (s ? s[0].toLocaleUpperCase("es") + s.slice(1) : s);

export function ordenarDescripcion(texto: string | undefined | null, d: DatosEstructurados): DescripcionOrdenada {
  const salida: DescripcionOrdenada = { grupos: [], parrafos: [], datos: [], conflictos: [] };
  if (!texto || !texto.trim()) return salida;

  // Líneas limpias; "" marca un salto de bloque.
  const lineas = texto.replace(/\r/g, "").split("\n").map((l) => {
    const c = limpiar(l);
    return c && !esSeparador(c) ? c : "";
  });

  let grupo: { titulo?: string; items: string[] } = { items: [] };
  const grupos: { titulo?: string; items: string[] }[] = [grupo];
  let heading = false; // el grupo actual lo abrió un subtítulo y aún puede recibir líneas tras un salto
  let primeraLineaDeBloque = true;
  let titularListo = false;

  const nuevoGrupo = (titulo?: string) => {
    grupo = { titulo, items: [] };
    grupos.push(grupo);
  };
  const dato = (etiqueta: string, valor: string) => {
    if (!salida.datos.some((x) => x.etiqueta === etiqueta)) salida.datos.push({ etiqueta, valor });
  };
  const conflicto = (c: Campo) => {
    if (!salida.conflictos.includes(c)) salida.conflictos.push(c);
  };
  const item = (s: string) => {
    if (!grupo.items.includes(s)) grupo.items.push(s);
  };

  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i];

    if (!l) {
      // Un salto cierra el grupo, salvo un subtítulo que aún no recibió nada.
      if (!(heading && grupo.items.length === 0)) {
        nuevoGrupo();
        heading = false;
      }
      primeraLineaDeBloque = true;
      continue;
    }
    const primera = primeraLineaDeBloque;
    primeraLineaDeBloque = false;
    const n = norm(l);

    // Plantilla y redundancias evidentes.
    if (/^ficha tecnica/.test(n)) continue;
    if (/^(apartamento|casa|inmueble|propiedad|apartaestudio|oficina|local|lote|finca)\s+en venta$/.test(n)) continue;

    // "Etiqueta: valor"
    const kv = l.match(/^([^:]{2,40}):\s*(.+)$/);
    if (kv && kv[1].trim().split(/\s+/).length <= 4) {
      const etiqueta = kv[1].trim();
      const valor = kv[2].trim();
      const ne = norm(etiqueta);
      const clave = CLAVES.find((c) => c.re.test(ne));
      if (clave) {
        const enTexto = primerNumero(valor, clave.dinero);
        const enFicha = valorFicha(clave.campo, d);
        if (enFicha === undefined || enTexto === undefined) {
          // La ficha no lo muestra: se conserva como dato (o, si es un conteo con detalle, como característica).
          if (clave.campo === "parqueaderos" && /[a-z]{3,}/i.test(valor.replace(/\d+/g, ""))) item(`Parqueaderos ${valor.replace(/^\d+\s*/, "")}`.trim());
          else dato(etiqueta, valor);
        } else {
          if (!acuerdo(clave.campo, enTexto, enFicha)) conflicto(clave.campo);
          const detalle = valor.replace(/^[\d.,\s$]+(m2|m²)?/i, "").trim();
          if (clave.campo === "parqueaderos" && detalle) item(`Parqueaderos ${detalle}`);
        }
        continue;
      }
      if (/^estrato$/.test(ne)) {
        dato("Estrato", valor);
        continue;
      }
      if (/^(si|sí)$/i.test(valor)) {
        item(mayus1(etiqueta));
        continue;
      }
      if (/^no$/i.test(valor)) continue;
      dato(mayus1(etiqueta), valor);
      continue;
    }

    // "Estrato 5"
    const estrato = n.match(/^estrato\s+(\d)$/);
    if (estrato) {
      dato("Estrato", estrato[1]);
      continue;
    }

    // "4 habitaciones" / "3 alcobas, cada una con baño…" / "2 garajes"
    const conteo = l.match(CONTEO);
    if (conteo) {
      const campo = campoDeSustantivo(conteo[2]);
      const enFicha = valorFicha(campo, d);
      const cantidad = Number(conteo[1]);
      const resto = conteo[3].trim();
      if (enFicha !== undefined && !acuerdo(campo, cantidad, enFicha)) conflicto(campo);
      if (!resto && enFicha !== undefined) continue;
      if (!resto) {
        item(mayus1(l));
        continue;
      }
      if (campo === "parqueaderos") item(mayus1(resto.replace(/^[,;]\s*/, "")));
      else item(l);
      continue;
    }

    // "122 m²" suelto
    const areaSuelta = l.match(/^([\d.,]+)\s*(?:m2|m²|mts2|metros(?: cuadrados)?)$/i);
    if (areaSuelta) {
      const v = primerNumero(areaSuelta[1], false);
      if (d.area !== undefined && v !== undefined) {
        if (!acuerdo("área", v, d.area)) conflicto("área");
        continue;
      }
      dato("Área", `${areaSuelta[1]} m²`);
      continue;
    }

    // Subtítulo: termina en ":" (sin valor)
    if (/:$/.test(l)) {
      nuevoGrupo(l.replace(/:$/, "").trim());
      heading = true;
      continue;
    }

    const palabras = l.split(/\s+/).length;
    const finaPunto = /[.!?]$/.test(l);

    // Titular: primera línea sola de la descripción, sin punto final
    if (!titularListo && primera && !salida.titular && i === lineas.findIndex((x) => x && !/^ficha tecnica/.test(norm(x)) && !/\s+en venta$/.test(norm(x))) && palabras >= 4 && !finaPunto) {
      const sigueBloque = lineas[i + 1] === "" || lineas[i + 1] === undefined;
      if (sigueBloque) {
        salida.titular = l;
        titularListo = true;
        continue;
      }
    }
    titularListo = true;

    // Frase larga → párrafo; línea corta → característica
    if (l.length > 60 || finaPunto || palabras > 9) {
      salida.parrafos.push(l);
      heading = false;
      continue;
    }
    item(mayus1(l));
  }

  salida.grupos = grupos.filter((g) => g.items.length > 0);
  return salida;
}
