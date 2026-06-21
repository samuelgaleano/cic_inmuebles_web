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

export { SESSION_COOKIE } from "./session";
