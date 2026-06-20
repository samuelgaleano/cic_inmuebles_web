import crypto from "node:crypto";

/**
 * Sesión de administrador basada en un token firmado (HMAC-SHA256).
 *
 * Enfoque de costo cero y sin dependencias externas: válido para un equipo
 * pequeño. En Fase 1b se puede migrar a Supabase Auth (multiusuario) sin
 * cambiar las vistas, ya que la sesión se consume vía `getAdminSession()`.
 */

const SECRET =
  process.env.ADMIN_SESSION_SECRET ?? "dev-insecure-secret-cambia-esto-en-produccion";

export const SESSION_COOKIE = "cic_admin";
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días

export interface SessionPayload {
  email: string;
  exp: number;
}

function sign(data: string): string {
  return crypto.createHmac("sha256", SECRET).update(data).digest("base64url");
}

export function createSessionToken(email: string, ttlMs: number = DEFAULT_TTL_MS): string {
  const payload: SessionPayload = { email, exp: Date.now() + ttlMs };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${sign(data)}`;
}

export function verifySessionToken(token?: string | null): SessionPayload | null {
  if (!token) return null;
  const [data, sig] = token.split(".");
  if (!data || !sig) return null;

  const expected = sign(data);
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;

  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString()) as SessionPayload;
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Compara credenciales en tiempo constante. */
export function validateCredentials(email: string, password: string): boolean {
  const expectedEmail = (process.env.ADMIN_EMAIL ?? "admin@cicinmuebles.com").toLowerCase();
  const expectedPassword = process.env.ADMIN_PASSWORD ?? "cic-admin-2026";

  const emailOk = safeEqual(email.trim().toLowerCase(), expectedEmail);
  const passOk = safeEqual(password, expectedPassword);
  return emailOk && passOk;
}

function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}
