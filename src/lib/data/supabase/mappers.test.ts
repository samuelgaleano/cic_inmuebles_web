import { describe, expect, it } from "vitest";
import type { LeadRow, PropertyRowLectura } from "./filas";
import type { LeadInput } from "@/lib/domain";
import { COLUMNAS_0012_LEADS, faltaColumna, leadInputToRow, leadRowToDomain, propertyRowToDomain, sinColumnas } from "./mappers";

describe("columnas de la migración 0012", () => {
  it("reconoce el error de columna inexistente de PostgREST y de Postgres, y nada más", () => {
    expect(faltaColumna({ code: "PGRST204", message: "Could not find the 'utm_source' column of 'leads' in the schema cache" }, COLUMNAS_0012_LEADS)).toBe(true);
    expect(faltaColumna({ code: "42703", message: 'column "consentimiento_at" of relation "leads" does not exist' }, COLUMNAS_0012_LEADS)).toBe(true);
    expect(faltaColumna({ code: "PGRST204", message: "Could not find the 'otra' column" }, COLUMNAS_0012_LEADS)).toBe(false);
    expect(faltaColumna({ code: "23505", message: "utm_source duplicate" }, COLUMNAS_0012_LEADS)).toBe(false);
    expect(faltaColumna(null, COLUMNAS_0012_LEADS)).toBe(false);
  });

  it("el respaldo quita solo las columnas nuevas", () => {
    const input: LeadInput = {
      tipo: "comprador",
      nombre: "Ana",
      telefono: "+57 300 123 4567",
      fuente: "web",
      origen: { utmSource: "instagram" },
      consentimientoAt: "2026-11-28T10:00:00.000Z",
      consentimientoVersion: "2026-09",
    };
    const fila = leadInputToRow(input);
    expect(fila).toMatchObject({ utm_source: "instagram", consentimiento_version: "2026-09" });
    const vieja = sinColumnas(fila, COLUMNAS_0012_LEADS);
    for (const c of COLUMNAS_0012_LEADS) expect(vieja).not.toHaveProperty(c);
    expect(vieja).toMatchObject({ nombre: "Ana", telefono: "+57 300 123 4567" });
  });

  it("lee el origen, la autorización y el primer contacto de la fila", () => {
    const lead = leadRowToDomain({
      id: "l1",
      tipo: "comprador",
      nombre: "Ana",
      telefono: "x",
      utm_source: "facebook",
      referente: "m.facebook.com",
      consentimiento_at: "2026-11-28T10:00:00Z",
      consentimiento_version: "2026-09",
      primer_contacto_at: "2026-11-28T11:00:00Z",
      created_at: "2026-11-28T10:00:00Z",
    } as unknown as LeadRow);
    expect(lead.origen).toEqual({ utmSource: "facebook", referente: "m.facebook.com" });
    expect(lead.consentimientoVersion).toBe("2026-09");
    expect(lead.primerContactoAt).toBe("2026-11-28T11:00:00Z");
    // Filas anteriores a 0012: sin origen, sin romper.
    expect(leadRowToDomain({ id: "l0", tipo: "vendedor", nombre: "B", telefono: "y", created_at: "x" } as unknown as LeadRow).origen).toBeUndefined();
  });

  it("el anunciante solo existe si tiene WhatsApp", () => {
    const base = { id: "p", codigo: "1", slug: "s", titulo: "T", tipo: "casa", estado: "disponible", precio: 1, ciudad: "Bogotá" };
    expect(propertyRowToDomain({ ...base, anunciante_nombre: "Norte", anunciante_whatsapp: "+57 310 555 2020" } as unknown as PropertyRowLectura).anunciante).toEqual({
      nombre: "Norte",
      whatsapp: "+57 310 555 2020",
    });
    expect(propertyRowToDomain({ ...base, anunciante_nombre: "Norte" } as unknown as PropertyRowLectura).anunciante).toBeUndefined();
  });
});
