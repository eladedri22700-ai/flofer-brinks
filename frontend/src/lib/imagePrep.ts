/** Prepare photos for OCR upload — resize large images to speed up upload. */

const MAX_EDGE = 2000;
const JPEG_QUALITY = 0.82;

export function newDraftKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `d_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Decode via <img> — handles SVG everywhere and HEIC on Safari, where createImageBitmap may not. */
function decodeWithImg(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("decode failed"));
    };
    img.src = url;
  });
}

/**
 * The reader accepts only JPEG / PNG / WebP / GIF. Anything else (SVG, HEIC from
 * iPhone, BMP…) and large photos are re-encoded to a resized JPEG here.
 */
export async function prepareImageForUpload(file: File): Promise<File> {
  const type = (file.type || "").toLowerCase();
  const supported = /^image[/](jpeg|jpg|png|webp|gif)$/.test(type);
  if (supported && file.size < 400_000) return file;

  let source: CanvasImageSource;
  let width: number;
  let height: number;
  try {
    const bitmap = await createImageBitmap(file);
    source = bitmap;
    width = bitmap.width;
    height = bitmap.height;
  } catch {
    try {
      const img = await decodeWithImg(file);
      source = img;
      width = img.naturalWidth || 1200;
      height = img.naturalHeight || 1600;
    } catch {
      // Can't decode here (e.g. HEIC on Android) — server explains in Hebrew.
      return file;
    }
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  // White backdrop: transparent SVG/PNG text would turn black in JPEG
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(source, 0, 0, w, h);
  if ("close" in source && typeof source.close === "function") source.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
  );
  if (!blob) return file;
  const base = file.name.replace(/\.[^.]+$/, "") || "photo";
  return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
}

export const IMAGE_ACCEPT =
  "image/*,.heic,.heif,.jpg,.jpeg,.png,.webp,.gif";
