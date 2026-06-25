# Estructura del Drive de inmuebles — CIC

Así debes organizar el Google Drive de la empresa. El sistema ya está
preparado para leer **esta estructura de 2 niveles**: la **ciudad** se toma
automáticamente de la carpeta padre, y cada carpeta de inmueble se importa
como un borrador con sus fotos.

## 🗂️ Estructura general

```
db inmuebles/                         ← CARPETA GENERAL (la raíz)
│                                       Este es el GOOGLE_DRIVE_ROOT_FOLDER_ID.
│                                       Compártela con la cuenta de servicio (Editor).
│
├── Bogotá/                           ← CARPETA DE CIUDAD
│   ├── CIC-BOG-001 — Apartamento Chapinero/     ← CARPETA DE INMUEBLE
│   │   ├── especificaciones.md       ← la ficha (usa la plantilla)
│   │   ├── 01-fachada.jpg            ← fotos (la 01 será la portada)
│   │   ├── 02-sala.jpg
│   │   ├── 03-cocina.jpg
│   │   └── 04-habitacion.jpg
│   │
│   ├── CIC-BOG-002 — Casa Usaquén/
│   │   ├── especificaciones.md
│   │   ├── 01-fachada.jpg
│   │   └── ...
│   │
│   └── CIC-BOG-003 — Apartaestudio Cedritos/
│       └── ...
│
└── Cali/                            ← OTRA CIUDAD
    ├── CIC-CAL-001 — Casa Granada/
    │   ├── especificaciones.md
    │   └── ...
    └── CIC-CAL-002 — Apartamento Ciudad Jardín/
        └── ...
```

## 📛 Nombres y convención (regla simple)

| Nivel | Cómo se nombra | Ejemplo |
|---|---|---|
| **General (raíz)** | `db inmuebles` | `db inmuebles` |
| **Ciudad** | Solo el nombre de la ciudad, con tilde | `Bogotá`, `Cali` |
| **Inmueble** | `CÓDIGO — Tipo Sector` | `CIC-BOG-001 — Apartamento Chapinero` |
| **Fotos** | `##-descripcion.jpg` (numeradas) | `01-fachada.jpg`, `02-sala.jpg` |
| **Ficha** | siempre `especificaciones.md` | `especificaciones.md` |

### Cómo se clasifica un inmueble dentro de una ciudad (el CÓDIGO)
Usa un código corto y único por inmueble, así:

```
CIC - <CIUDAD(3 letras)> - <consecutivo de 3 dígitos>
        BOG = Bogotá
        CAL = Cali
        MED = Medellín (cuando la agregues)
```
Ejemplos: `CIC-BOG-001`, `CIC-BOG-002`, `CIC-CAL-001`.
- El consecutivo va subiendo (001, 002, 003…) **por ciudad**.
- Después del código, agrega un texto humano para reconocerlo a simple vista:
  `CIC-BOG-014 — Casa campestre La Calera`.

> El código es solo para **organizarte tú** en Drive. El **título real** que se
> publica en la web lo defines dentro de `especificaciones.md` (campo `titulo:`).

## 🔌 Cómo lo lee el sistema (importante)

- **Ciudad:** se toma del **nombre de la carpeta de ciudad** (`Bogotá`, `Cali`).
  No tienes que repetirla, aunque puedes ponerla también en la ficha.
- **Título, precio, características, descripción:** salen de `especificaciones.md`.
- **Fotos:** todas las imágenes de la carpeta; la **primera en orden** (por eso
  van numeradas `01`, `02`, …) será la **portada**.
- **Estado inicial:** se importa como **borrador** (no se publica solo); tú lo
  revisas en el panel y lo marcas como **Publicado**.
- **No duplica:** si vuelves a importar, los inmuebles ya traídos se omiten.

## ✅ Pasos para montarlo
1. Crea la carpeta **`db inmuebles`** y compártela como **Editor** con la
   cuenta de servicio (el correo `...iam.gserviceaccount.com`).
2. Crea dentro las carpetas **`Bogotá`** y **`Cali`**.
3. Por cada inmueble: crea su carpeta (`CIC-BOG-001 — …`), súbele las **fotos**
   numeradas y la **`especificaciones.md`** (plantilla) rellena.
4. En el panel: **Inmuebles → "Importar de Drive" → "Escanear e importar"**.
5. Revisa los borradores y publícalos.

> Consejo: deja una copia de `especificaciones.md` (vacía/plantilla) en la raíz
> `db inmuebles` para que tus agentes la copien rápido en cada carpeta nueva.
