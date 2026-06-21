import Link from "next/link";
import { Home, Search } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 text-center">
      <p className="text-6xl font-bold text-brand-700">404</p>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">Página no encontrada</h1>
      <p className="mt-2 max-w-md text-slate-500">
        Es posible que el inmueble que buscas ya no esté disponible o que la dirección sea incorrecta.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand-700 px-5 text-sm font-semibold text-white hover:bg-brand-800"
        >
          <Home className="h-4 w-4" /> Ir al inicio
        </Link>
        <Link
          href="/inmuebles"
          className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <Search className="h-4 w-4" /> Ver catálogo
        </Link>
      </div>
    </div>
  );
}
