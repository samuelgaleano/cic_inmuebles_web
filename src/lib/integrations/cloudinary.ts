/**
 * Cloudinary — CDN de imágenes del catálogo.
 *
 * Estrategia de costo cero y motor visual único: todas las fotos del sitio
 * público se sirven desde Cloudinary (optimización + CDN, capa gratuita),
 * vengan del panel (subida directa) o de una importación de Google Drive.
 *
 * Esta integración del servidor reaprovecha el mismo *upload preset sin firmar*
 * que usa el panel; así no requiere API secret y mantiene la configuración
 * mínima. Si Cloudinary no está configurado, todo cae con elegancia a las URLs
 * originales (p. ej. Drive), sin romper el flujo.
 */

export function isCloudinaryConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME &&
      process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET,
  );
}

export interface CloudinaryUpload {
  url: string;
  publicId: string;
}

/**
 * Sube una imagen **remota** a Cloudinary indicándole su URL pública: Cloudinary
 * la descarga, la optimiza y la entrega desde su CDN. Pensado para re-alojar las
 * fotos importadas de Google Drive.
 *
 * Best-effort: devuelve `null` si no está configurado o si la subida falla, para
 * que el llamador conserve la URL original como respaldo.
 */
export async function uploadRemoteImage(remoteUrl: string): Promise<CloudinaryUpload | null> {
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const preset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
  if (!cloud || !preset) return null;

  try {
    const fd = new FormData();
    fd.append("file", remoteUrl);
    fd.append("upload_preset", preset);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, {
      method: "POST",
      body: fd,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { secure_url?: string; public_id?: string };
    if (!data.secure_url) return null;
    return { url: data.secure_url, publicId: data.public_id ?? "" };
  } catch (err) {
    console.error("[cloudinary] No se pudo re-alojar la imagen remota:", err);
    return null;
  }
}
