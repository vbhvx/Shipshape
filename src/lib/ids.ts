/**
 * Prefixed, collision-resistant identifiers (`proj_…`, `run_…`).
 *
 * The time component keeps IDs roughly sortable for log reading; the random
 * component comes from the CSPRNG so IDs are not guessable, unlike
 * `Math.random()` which earlier code used.
 */
export function newId(prefix: string): string {
  const random = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  return `${prefix}_${Date.now().toString(36)}${random}`;
}
