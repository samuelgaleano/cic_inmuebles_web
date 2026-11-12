import { beforeEach, describe, expect, it, vi } from "vitest";

const { revalidateTag, unstableCache } = vi.hoisted(() => ({
  revalidateTag: vi.fn(),
  // Sin servidor de Next no hay caché de datos: la función envuelta se ejecuta tal cual.
  unstableCache: vi.fn((fn: () => unknown) => fn),
}));

vi.mock("next/cache", () => ({ revalidateTag, unstable_cache: unstableCache }));
vi.mock("react", async (orig) => ({ ...(await orig<typeof import("react")>()), cache: <T,>(fn: T) => fn }));
const listPublic = vi.hoisted(() => vi.fn());
vi.mock("@/lib/data", () => ({ getRepository: () => ({ properties: { listPublic } }) }));

const { INVENTARIO_TAG, INVENTARIO_REVALIDATE_S, invalidarInventario } = await import("./inventario-tag");
const { fichaDelInventario, getPublicInventory, getPublicInventoryOrThrow, getPublicPropertyBySlug } = await import("./public-inventory");

const ficha = (slug: string) => ({ slug }) as never;

describe("caché del inventario público", () => {
  beforeEach(() => {
    listPublic.mockReset();
  });

  it("la lectura se envuelve en la caché de datos con la etiqueta `inventario` y 6 h de vigencia", () => {
    expect(unstableCache).toHaveBeenCalledTimes(1);
    const [, , opciones] = unstableCache.mock.calls[0] as unknown as [unknown, unknown, { tags: string[]; revalidate: number }];
    expect(opciones.tags).toEqual([INVENTARIO_TAG]);
    expect(opciones.revalidate).toBe(INVENTARIO_REVALIDATE_S);
  });

  it("invalidarInventario vence la etiqueta al instante", () => {
    invalidarInventario();
    expect(revalidateTag).toHaveBeenCalledWith("inventario", { expire: 0 });
  });

  it("fichaDelInventario encuentra por slug y devuelve null si no existe", () => {
    const inv = [ficha("a"), ficha("b")];
    expect(fichaDelInventario(inv, "b")).toBe(inv[1]);
    expect(fichaDelInventario(inv, "no-existe")).toBeNull();
  });

  it("getPublicInventory degrada a [] si Supabase falla, pero OrThrow propaga el error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    listPublic.mockRejectedValue(new Error("caído"));
    expect(await getPublicInventory()).toEqual([]);
    await expect(getPublicInventoryOrThrow()).rejects.toThrow("caído");
    await expect(getPublicPropertyBySlug("x")).rejects.toThrow("caído");
  });

  it("un slug inexistente se resuelve con el inventario cacheado, una sola lectura", async () => {
    listPublic.mockResolvedValue([ficha("a")]);
    expect(await getPublicPropertyBySlug("a")).toEqual({ slug: "a" });
    expect(await getPublicPropertyBySlug("basura")).toBeNull();
  });
});
