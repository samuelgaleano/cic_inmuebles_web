import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-start justify-center px-5 sm:px-8 lg:px-[max(2rem,calc((100vw-75rem)/2+2rem))]">
      <p className="text-[15px] text-muted">Error 404</p>
      <h1 className="t-display mt-2 max-w-3xl">Esta página no existe.</h1>
      <p className="t-lead mt-5 max-w-xl">
        Es posible que el inmueble que buscas ya no esté disponible o que la dirección sea incorrecta.
      </p>
      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/inmuebles" className={buttonVariants({ variant: "primary", size: "lg" })}>
          Ver los inmuebles
        </Link>
        <Link href="/" className={buttonVariants({ variant: "outline", size: "lg" })}>
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}
