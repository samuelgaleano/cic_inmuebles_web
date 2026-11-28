import crypto from "node:crypto";

/**
 * Sesión de administrador basada en un token firmado (HMAC-SHA256).
 *
 * Enfoque de costo cero y sin dependencias externas: válido para un equipo
 * pequeño. En Fase 1b se puede migrar a Supabase Auth (multiusuario) sin
 * cambiar las vistas, ya que la sesión se consume vía `getAdminSession()`.
 */

// Correo por defecto SOLO para desarrollo local (no es secreto). La contrasena y
// el secreto de firma NO tienen valor por defecto en el codigo: si faltan en
// local se generan al azar en memoria (ver `valoresDeDesarrollo`).
const DEV_EMAIL = "admin@cicinmuebles.com";

interface AdminConfig {
  secret: string;
  email: string;
  password: string;
}

interface ValoresDesarrollo {
  secret: string;
  password: string;
  avisado: boolean;
}

const global = globalThis as typeof globalThis & { __cicAdminDesarrollo?: ValoresDesarrollo };

/**
 * Secreto y contrasena de desarrollo generados al azar una vez por proceso. Viven
 * en `globalThis` para que el proxy y las acciones del servidor (bundles distintos
 * del mismo proceso) firmen y verifiquen con el mismo secreto. Reiniciar el
 * servidor de desarrollo los cambia y cierra la sesion: para algo estable, define
 * ADMIN_PASSWORD y ADMIN_SESSION_SECRET en `.env.local`.
 */
function valoresDeDesarrollo(): ValoresDesarrollo {
  global.__cicAdminDesarrollo ??= {
    secret: crypto.randomBytes(48).toString("base64url"),
    password: crypto.randomBytes(12).toString("base64url"),
    avisado: false,
  };
  return global.__cicAdminDesarrollo;
}

/**
 * Configuracion efectiva del panel. En produccion **falla cerrado**: si falta
 * cualquiera de las tres variables devuelve `null` y el panel queda inaccesible
 * (nadie entra). Fuera de produccion, lo que falte se genera en memoria y se
 * avisa una vez en la consola (con la contrasena temporal, para poder entrar).
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

  if (secret && password) return { secret, email: email || DEV_EMAIL, password };

  const dev = valoresDeDesarrollo();
  if (!dev.avisado && process.env.NODE_ENV !== "test") {
    dev.avisado = true;
    console.warn(
      "[seguridad] Panel admin en modo desarrollo: falta " +
        [!secret && "ADMIN_SESSION_SECRET", !password && "ADMIN_PASSWORD"].filter(Boolean).join(" y ") +
        " en .env.local; se generaron valores temporales que duran hasta reiniciar el servidor." +
        (password ? "" : ` Entra con ${email || DEV_EMAIL} y la clave temporal ${dev.password}`),
    );
  }
  return {
    secret: secret || dev.secret,
    email: email || DEV_EMAIL,
    password: password || dev.password,
  };
}

export const SESSION_COOKIE = "cic_admin";
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días

export interface SessionPayload {
  email: string;
  exp: number;
}

/**
 * Huella de la contrasena del panel (sha256). Entra en la firma de cada token:
 * cambiar ADMIN_PASSWORD invalida de inmediato todas las sesiones abiertas, sin
 * lista de revocacion ni base de datos. La contrasena nunca viaja en el token.
 */
function huellaClave(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function sign(data: string, config: AdminConfig): string {
  return crypto
    .createHmac("sha256", config.secret)
    .update(data)
    .update("\0")
    .update(huellaClave(config.password))
    .digest("base64url");
}

export function createSessionToken(email: string, ttlMs: number = DEFAULT_TTL_MS): string {
  const config = adminConfig();
  if (!config) {
    throw new Error("Panel admin sin configurar: no se pueden emitir sesiones.");
  }

  const payload: SessionPayload = { email, exp: Date.now() + ttlMs };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${sign(data, config)}`;
}

export function verifySessionToken(token?: string | null): SessionPayload | null {
  const config = adminConfig();
  if (!config) return null;
  if (!token) return null;
  const [data, sig] = token.split(".");
  if (!data || !sig) return null;

  const expected = sign(data, config);
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;

  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString()) as SessionPayload;
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    // Cambiar ADMIN_EMAIL tambien cierra las sesiones emitidas para el correo anterior.
    if (typeof payload.email !== "string" || payload.email !== config.email.toLowerCase()) return null;
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
