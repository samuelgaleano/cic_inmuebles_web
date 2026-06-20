"use client";

import { useActionState } from "react";
import { Loader2, Lock } from "lucide-react";
import { loginAction, type LoginState } from "@/lib/actions/auth";

const initial: LoginState = {};

const inputClass =
  "h-11 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200";

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, isPending] = useActionState(loginAction, initial);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Correo</label>
        <input name="email" type="email" autoComplete="username" className={inputClass} required />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Contraseña</label>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          className={inputClass}
          required
        />
      </div>

      {state.error && <p className="text-sm text-rose-600">{state.error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-700 font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
        Ingresar
      </button>
    </form>
  );
}
