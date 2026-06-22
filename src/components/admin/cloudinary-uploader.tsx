"use client";

import { useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";

/**
 * Carga directa de imágenes a Cloudinary (subida sin firmar con upload preset).
 *
 * Estrategia de costo cero: si Cloudinary no está configurado, no se muestra y
 * el formulario sigue funcionando pegando URLs manualmente.
 */
export function CloudinaryUploader({ onUploaded }: { onUploaded: (urls: string[]) => void }) {
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const preset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!cloud || !preset) {
    return (
      <p className="text-xs text-muted">
        Activa la carga directa configurando Cloudinary
        (NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME y NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET).
      </p>
    );
  }

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setUploading(true);
    setError(null);
    const urls: string[] = [];
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("upload_preset", preset!);
        const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, {
          method: "POST",
          body: fd,
        });
        if (!res.ok) throw new Error("upload failed");
        const data = (await res.json()) as { secure_url: string };
        urls.push(data.secure_url);
      }
      onUploaded(urls);
    } catch {
      setError("No se pudieron subir algunas imágenes. Intenta de nuevo.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-white px-4 py-2 text-sm font-medium text-ink-soft transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700">
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
        {uploading ? "Subiendo..." : "Subir imágenes"}
        <input type="file" accept="image/*" multiple onChange={handleChange} disabled={uploading} className="hidden" />
      </label>
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
