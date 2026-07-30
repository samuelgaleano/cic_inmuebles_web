import crypto from "node:crypto";

/**
 * Sesión de administrador basada en un token firmado (HMAC-SHA256).
 *
 * Enfoque de costo cero y sin dependencias externas: válido para un equipo
 * pequeño. En Fase 1b se puede migrar a Supabase Auth (multiusuario) sin
 * cambiar las vistas, ya que la sesión se consume vía `getAdminSession()`.
 */

// Valores por defecto SOLO para desarrollo local: estan publicados en el
// repositorio, asi que en produccion no se usan nunca (ver `adminConfig`).
const DEV_SECRET = "dev-insecure-secret-cambia-esto-en-produccion";
const DEV_EMAIL = "admin@cicinmuebles.com";
const DEV_PASSWORD = "cic-admin-2026";

interface AdminConfig {
  secret: string;
  email: string;
  password: string;
}

/**
 * Configuracion efectiva del panel. En produccion **falla cerrado**: si falta
 * cualquiera de las tres variables devuelve `null` y el panel queda inaccesible
 * (nadie entra, ni siquiera con los valores por defecto del repo). Fuera de
 * produccion cae a los valores de desarrollo para poder trabajar en local.
 *
 * Se lee en cada llamada (no al cargar el modulo) para que rotar el secreto o
 * las credenciales tenga efecto sin reconstruir el bundle.
 */
function adminConfig(): AdminConfig | null {
  const secret = process.env.ADMIN_SESSION_SECRET;
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (process.env.NODE_ENV === "production") {
    if (!secret || !email || !password) {
      console.error(
        "[seguridad] Panel admin DESACTIVADO: faltan ADMIN_SESSION_SECRET, ADMIN_EMAIL o " +
          "ADMIN_PASSWORD. Definelas en Vercel (Production) y vuelve a desplegar.",
      );
      return null;
    }
    return { secret, email, password };
  }

  return {
    secret: secret || DEV_SECRET,
    email: email || DEV_EMAIL,
    password: password || DEV_PASSWORD,
  };
}

export const SESSION_COOKIE = "cic_admin";
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días

export interface SessionPayload {
  email: string;
  exp: number;
}

function sign(data: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(data).digest("base64url");
}

export function createSessionToken(email: string, ttlMs: number = DEFAULT_TTL_MS): string {
  const config = adminConfig();
  if (!config) {
    throw new Error("Panel admin sin configurar: no se pueden emitir sesiones.");
  }

  const payload: SessionPayload = { email, exp: Date.now() + ttlMs };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${sign(data, config.secret)}`;
}

export function verifySessionToken(token?: string | null): SessionPayload | null {
  const config = adminConfig();
  if (!config) return null;
  if (!token) return null;
  const [data, sig] = token.split(".");
  if (!data || !sig) return null;

  const expected = sign(data, config.secret);
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
  const config = adminConfig();
  if (!config) return false;

  const emailOk = safeEqual(email.trim().toLowerCase(), config.email.toLowerCase());
  const passOk = safeEqual(password, config.password);
  return emailOk && passOk;
}

function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}
