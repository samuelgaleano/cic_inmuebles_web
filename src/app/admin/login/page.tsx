import type { Metadata } from "next";
import { Building2 } from "lucide-react";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/login-form";
import { getAdminSession } from "@/lib/auth";
import { siteConfig } from "@/lib/config/site";

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
  // Si ya hay sesión, ir directo al panel.
  if (await getAdminSession()) redirect("/admin");

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-700 text-white">
            <Building2 className="h-6 w-6" />
          </span>
          <h1 className="mt-3 text-xl font-bold text-brand-900">{siteConfig.name}</h1>
          <p className="text-sm text-slate-500">Panel de administración</p>
        </div>
        <LoginForm next={next ?? "/admin"} />
      </div>
    </div>
  );
}
