import { beforeEach, describe, expect, it, vi } from "vitest";
import { correoDeAviso, correoPagoRecibido, correoPublicacionActiva, correoRenovacionPagada, nombrePropio } from "./correos";
import { escapeHtml } from "./correo-html";
import { fechaHora, type Servicio } from "./vigencia";

function servicio(extra: Partial<Servicio> = {}): Servicio {
  return {
    id: "b499b8e3-d6d6-4fef-a0ad-4ecedb66a023",
    txId: "1446679-1792296260-41495",
    reference: "CIC-alianza-90-595037-1792296218150",
    planId: "alianza-90",
    dias: 90,
    clienteEmail: "samuel@ejemplo.co",
    clienteNombre: "samuel galeano",
    clienteTelefono: "573012679392",
    estado: "activo",
    propertySlug: "area19-calleja",
    inicioAt: "2026-10-18T04:33:53.000Z",
    venceAt: "2027-01-16T04:33:53.000Z",
    aviso7dAt: null,
    aviso1dAt: null,
    avisoVencidoAt: null,
    createdAt: "2026-10-18T04:14:26.000Z",
    ...extra,
  };
}

describe("fechaHora", () => {
  it("siempre en hora de Bogotá (UTC-5), con am/pm", () => {
    expect(fechaHora("2026-10-18T04:14:26.000Z")).toMatch(/17 de octubre de 2026.*11:14\s?p\.\s?m\./);
    expect(fechaHora("2027-01-16T17:05:00.000Z")).toMatch(/16 de enero de 2027.*12:05\s?p\.\s?m\./);
  });
});

describe("correos al cliente: plantilla con la marca", () => {
  beforeEach(() => {
    vi.stubEnv("RENOVACION_SECRET", "secreto-de-prueba");
  });

  it("el nombre se capitaliza y el saludo no queda en minúscula", () => {
    expect(nombrePropio({ clienteNombre: "samuel galeano" })).toBe("Samuel");
    expect(nombrePropio({ clienteNombre: "  MARTA pérez " })).toBe("MARTA");
    expect(nombrePropio({ clienteNombre: null })).toBeNull();
    expect(correoPagoRecibido(servicio())!.text).toContain("Hola Samuel,");
  });

  it("el pago recibido trae HTML y texto con plan, valor, hora de Bogotá, referencia y comercio del extracto", () => {
    const c = correoPagoRecibido(servicio({ estado: "pendiente_publicar", propertySlug: null }))!;
    for (const parte of ["Alianza por resultados", "CIC-alianza-90-595037-1792296218150", "Distribuciones JS", "+57 301 267 9392"]) {
      expect(c.html, parte).toContain(parte);
      expect(c.text, parte).toContain(parte);
    }
    expect(c.html).toMatch(/\$\s10\.000/);
    expect(c.text).toMatch(/\$\s10\.000/);
    expect(c.html).toMatch(/11:14\s?p\.\s?m\./);
    expect(c.html).toContain("<!doctype html>");
    expect(c.replyTo).toBeTruthy();
  });

  it("no queda ningún punto doble por las fechas que terminan en «p. m.»", () => {
    for (const c of [correoDeAviso(servicio(), "7d")!, correoDeAviso(servicio(), "1d")!, correoRenovacionPagada(servicio())!, correoPublicacionActiva(servicio())!]) {
      expect(c.text).not.toMatch(/\.\./);
      expect(c.html).not.toMatch(/p\. m\.\./);
    }
  });

  it("el botón de renovación lleva al enlace firmado y el HTML escapa lo que escribió la persona", () => {
    const c = correoDeAviso(servicio({ clienteNombre: "<b>Ana</b> & Co" }), "7d")!;
    expect(c.html).toMatch(/href="https:\/\/www\.cicinmuebles\.com\/publica\/agente\?renovar=[^"]+"/);
    expect(c.html).not.toContain("<b>Ana</b>");
    expect(escapeHtml(`a<b>"c"&'d'`)).toBe("a&lt;b&gt;&quot;c&quot;&amp;&#39;d&#39;");
  });

  it("el texto no repite el enlace de WhatsApp cuando ya es el botón", () => {
    const c = correoPagoRecibido(servicio({ estado: "pendiente_publicar", propertySlug: null }))!;
    expect(c.text.match(/wa\.me/g)).toHaveLength(1);
  });
});
