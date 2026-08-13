/** Prepare photos for OCR upload — resize large images to speed up upload. */

const MAX_EDGE = 2000;
const JPEG_QUALITY = 0.82;

export function newDraftKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `d_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function prepareImageForUpload(file: File): Promise<File> {
  const name = (file.name || "photo").toLowerCase();
  const type = (file.type || "").toLowerCase();

  // Keep SVG / already-small files as-is (demo assets, screenshots).
  if (type.includes("svg") || name.endsWith(".svg")) return file;
  if (file.size < 400_000 && (type.includes("jpeg") || type.includes("jpg") || type.includes("png") || type.includes("webp"))) {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    if (!blob) return file;
    const base = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
  } catch {
    // HEIC / unsupported decode — send original; server may reject with Hebrew error.
    return file;
  }
}

export const IMAGE_ACCEPT =
  "image/*,.heic,.heif,.jpg,.jpeg,.png,.webp,.gif";
