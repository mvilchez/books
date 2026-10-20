/**
 * Saga route helpers.
 *
 * Next.js does not decode dynamic route parameters: `/sagas/Ciclo%20Barroco`
 * arrives as the raw string "Ciclo%20Barroco". Saga names are stored
 * decoded in the database, so the parameter must be decoded before it is
 * used for an exact lookup. Decoding is applied defensively: malformed
 * percent escapes yield `null` (the caller renders a 404) instead of
 * throwing a URIError.
 */

/**
 * Decode a saga name taken from a dynamic route parameter.
 *
 * Returns `null` when the value cannot be decoded (malformed percent
 * encoding) or when it does not contain any usable characters.
 */
export function decodeSagaRouteName(rawName: string | null | undefined): string | null {
  if (typeof rawName !== "string") return null;
  const trimmed = rawName.trim();
  if (trimmed === "") return null;

  let decoded: string;
  try {
    decoded = decodeURIComponent(trimmed);
  } catch {
    return null;
  }
  const normalized = decoded.trim();
  return normalized === "" ? null : normalized;
}
