import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySessionToken, type SessionPayload } from "./session";

/** Devuelve la sesión activa del admin (o null) leyendo la cookie. */
export async function getAdminSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

/** Exige sesión: redirige a /admin/login si no hay sesión válida. */
export async function requireAdminSession(): Promise<SessionPayload> {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  return session;
}

/**
 * Guardia de las server actions del panel. El proxy solo protege las rutas
 * /admin, pero una server action se puede invocar con un POST dirigido a
 * cualquier pagina del sitio: por eso cada accion exportada de
 * `src/lib/actions/admin-*.ts` la llama en su primera linea, antes de leer el
 * formulario o tocar el repositorio.
 *
 * Sin sesion valida redirige a /admin/login (`redirect` lanza), de modo que la
 * accion nunca llega a ejecutarse. El aviso en el log no incluye datos de la
 * peticion.
 */
export async function exigirAdmin(): Promise<SessionPayload> {
  const session = await getAdminSession();
  if (!session) {
    console.warn("[seguridad] accion del panel sin sesion valida: rechazada");
    redirect("/admin/login");
  }
  return session;
}

export { SESSION_COOKIE } from "./session";
