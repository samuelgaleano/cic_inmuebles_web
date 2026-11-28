"use client"; // Los límites de error son componentes de cliente.

/**
 * Último recurso: falla el layout raíz. Reemplaza todo el documento, así que trae su propio <html> y <body> y
 * estilos en línea (aquí no llegan globals.css ni las fuentes).
 */
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="es">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f4f7f5", color: "#0b1a15" }}>
        <title>Ocurrió un error | CIC Inmuebles</title>
        <main style={{ maxWidth: 520, margin: "15vh auto", padding: "0 20px" }}>
          <h1 style={{ fontSize: 24, margin: "0 0 12px" }}>Ocurrió un error.</h1>
          <p style={{ margin: "0 0 24px", lineHeight: 1.5 }}>Intenta de nuevo en un momento. Si sigue pasando, escríbenos por WhatsApp al +57 324 907 1717.</p>
          <button
            type="button"
            onClick={() => retry()}
            style={{ minHeight: 44, padding: "0 20px", border: 0, borderRadius: 12, background: "#047d5b", color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer" }}
          >
            Reintentar
          </button>
        </main>
      </body>
    </html>
  );
}
