/** Product copyright / ownership notice (UI + legal page). */

export const COPYRIGHT_YEAR = 2026;
export const PRODUCT_NAME = "FLOFER BRINKS";
export const COPYRIGHT_OWNER = "FLOFER BRINKS";

export function copyrightLine(): string {
  return `© ${COPYRIGHT_YEAR} ${COPYRIGHT_OWNER}. כל הזכויות שמורות.`;
}

export function copyrightShort(): string {
  return `© ${COPYRIGHT_YEAR} ${PRODUCT_NAME}`;
}
