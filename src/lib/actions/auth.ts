"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  SESSION_COOKIE,
  createSessionToken,
  validateCredentials,
} from "@/lib/auth/session";

export interface LoginState {
  error?: string;
}

/**
 * Espera fija ante credenciales invalidas. Frena la fuerza bruta (cada intento
 * fallido cuesta ~1 s) y, al ser igual para correo y contrasena equivocados, no
 * delata cual de los dos fallo. La comparacion en si ya es en tiempo constante
 * (`validateCredentials` compara huellas sha256 con `timingSafeEqual`).
 *
 * Esto no sustituye un limite por IP. En Vercel Firewall (Project > Firewall >
 * Configure > New Rule) se recomienda una regla de rate limit:
 *   If  Request Path  equals  /admin/login   AND   Method  equals  POST
 *   Then Rate Limit: ventana fija (Fixed Window) de 60 s, 10 peticiones, clave IP,
 *        al exceder -> 429 Too Many Requests
 * Las server actions del login viajan como POST a la misma URL de la pagina, por
 * eso la regla va sobre /admin/login. Verificar en el panel que la regla esta
 * disponible en el plan del proyecto antes de darla por puesta.
 */
const ESPERA_FALLO_MS = 1000;

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/admin");

  if (!validateCredentials(email, password)) {
    await esperar(ESPERA_FALLO_MS);
    return { error: "Correo o contraseña incorrectos." };
  }

  const token = createSessionToken(email.trim().toLowerCase());
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });

  redirect(next.startsWith("/admin") ? next : "/admin");
}

export async function logoutAction(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/admin/login");
}
