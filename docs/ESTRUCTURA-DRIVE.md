# Estructura del Drive de inmuebles — CIC

El sistema ya está adaptado a **tu organización actual**. Recorre el Drive en
profundidad y reconoce automáticamente **ciudad → estado → inmueble**.

## 🗂️ Estructura (como la tienes)

```
BD inmuebles/                              ← RAÍZ (GOOGLE_DRIVE_ROOT_FOLDER_ID)
│                                            Compártela (Editor) con la cuenta de servicio.
│
├── bogota/                                ← CIUDAD  (se muestra como "Bogotá")
│   └── inmuebles disponibles/             ← ESTADO  (→ estado = Disponible)
│       ├── 1006-palmeira-mazuren/         ← INMUEBLE (código 1006)
│       │   ├── 1006-palmeira-info.docx    ← info (Word)  ⚠️ ver nota
│       │   └── contenido visual/          ← FOTOS (se importan de aquí)
│       │       ├── WhatsApp Image ....jpeg
│       │       └── ...
│       ├── 1007-Tierra Colina-Gilmar/
│       │   ├── 1007-Tierra colina-info.docx
│       │   └── contenido audiovisual/ ...
│       └── 1011-Area19-Calleja XX/
│           ├── info inmueble/             ← (también vale la info en subcarpeta)
│           │   └── 1011-area19-info.docx
│           └── contenido visual/ ...
│
└── seguimiento e info inmuebles/          ← se IGNORA (no es ciudad ni inmueble)
```

> Más adelante puedes agregar `inmuebles vendidos/` o `inmuebles en proceso/`
> al mismo nivel que `inmuebles disponibles/` y el estado se asignará solo.

## 🔌 Qué reconoce el sistema automáticamente
- **Ciudad** → de la carpeta de ciudad (`bogota` → se normaliza a **Bogotá**).
- **Estado** → de la carpeta `inmuebles disponibles / vendidos / en proceso`.
- **Inmueble** → cualquier carpeta que tenga una subcarpeta de **contenido**
  (`contenido visual`, `contenido audiovisual`, …) o imágenes.
- **Fotos** → se toman de la subcarpeta de contenido (la primera = portada) y se
  comparten como públicas para mostrarse en el sitio.
- **Código y título** → del nombre de la carpeta: `1006-palmeira-mazuren`
  → código `1006`, título "Palmeira Mazuren".
- Se crea como **borrador**. No duplica si reimportas. La carpeta queda enlazada
  en el panel (sección "Archivo en Google Drive") para abrir el `.docx` y las fotos.

## ⚠️ Importante sobre la INFO de cada inmueble (.docx)
Los archivos **`.docx` de Word NO se pueden leer automáticamente**, así que el
**precio, área, habitaciones, etc. no se importan** desde ahí. Cada inmueble se
crea con **código + título + ciudad + estado + fotos**, y tú completas el resto
en el panel (puedes abrir el `.docx` desde la ficha del inmueble para copiar los
datos).

### Para que TODO se importe automático (recomendado)
Agrega en cada carpeta de inmueble un archivo **`especificaciones.md`** (usa la
plantilla que te pasé). Si está presente, el sistema toma de ahí precio, área,
habitaciones, descripción, etc. Alternativa: tener esa ficha como **Google Doc**
con formato `clave: valor` (también se lee). El `.docx` de Word, no.

## ✅ Pasos
1. Comparte **`BD inmuebles`** (Editor) con la cuenta de servicio.
2. (Opcional pero ideal) agrega `especificaciones.md` en cada carpeta de inmueble.
3. Panel → **Inmuebles → "Importar de Drive" → "Escanear e importar"**.
4. Revisa los borradores, completa lo que falte y **publícalos**.
