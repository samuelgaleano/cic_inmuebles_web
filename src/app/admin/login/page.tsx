import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/brand/brand-mark";
import { LoginForm } from "@/components/admin/login-form";
import { getAdminSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Acceso administrador",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  if (await getAdminSession()) redirect("/admin");

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink px-4 py-10">
      <div className="absolute inset-0 bg-aurora" />
      <div className="pointer-events-none absolute inset-0 bg-grain opacity-[0.04]" />

      <div className="relative w-full max-w-sm">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-white/55 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Volver al sitio
        </Link>

        <div className="rounded-[1.6rem] border border-white/10 bg-white/[0.04] p-1.5 backdrop-blur">
          <div className="rounded-[1.25rem] border border-line bg-white p-7 shadow-2xl">
            <Logo />
            <h1 className="mt-6 font-display text-xl font-bold tracking-tight text-ink">
              Panel de administración
            </h1>
            <p className="mt-1 text-sm text-muted">Ingresa con tus credenciales para continuar.</p>
            <div className="mt-6">
              <LoginForm next={next ?? "/admin"} />
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-white/35">
          Acceso restringido · CIC Inmuebles
        </p>
      </div>
    </div>
  );
}
