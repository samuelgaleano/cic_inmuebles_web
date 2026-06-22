import Link from "next/link";
import { Home, Search } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-4 text-center">
      <p className="font-display text-7xl font-extrabold tracking-tight text-brand-600">404</p>
      <h1 className="mt-4 text-2xl font-bold tracking-tight text-ink">Página no encontrada</h1>
      <p className="mt-2 max-w-md text-muted">
        Es posible que el inmueble que buscas ya no esté disponible o que la dirección sea incorrecta.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand-700 px-5 text-sm font-semibold text-white shadow-[0_10px_26px_-10px_rgba(4,125,91,0.8)] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-brand-800 active:scale-[0.98]"
        >
          <Home className="h-4 w-4" /> Ir al inicio
        </Link>
        <Link
          href="/inmuebles"
          className="inline-flex h-11 items-center gap-2 rounded-xl border border-line bg-white px-5 text-sm font-semibold text-ink-soft transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
        >
          <Search className="h-4 w-4" /> Ver catálogo
        </Link>
      </div>
    </div>
  );
}
