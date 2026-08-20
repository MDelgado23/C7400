/**
 * The sections the newsroom files notes under — PURE.
 *
 * The station's site splits its news into LOCALES, POLICIALES, DEPORTES, CAMPO
 * and a dozen more; the app has been showing all of them in one undifferentiated
 * list. Twenty notes already carry seven different sections, so somebody who
 * opens for the football result reads four crime stories on the way.
 *
 * `GET /category` lists them and `GET /article?category=<id>` filters — both
 * verified against the live host. Filtering by NAME returns HTTP 500; the id is
 * what the endpoint wants.
 *
 * THIS LIST IS DECORATION AROUND THE FEED. If it cannot be read the chips do
 * not appear and the news is unaffected, which is why nothing here throws.
 */

export interface NewsCategory {
  /** What `?category=` takes. */
  id: string;
  /** Written for a chip, not shouted — see `presentable`. */
  name: string;
}

/**
 * The API shouts: every section arrives in capitals, and one of them arrives as
 * `EDUCACIóN` — a lowercase ó stranded in the middle of a capitalised word.
 * Lowercasing first and capitalising each word fixes that for free and matches
 * how the station's own site writes them.
 *
 * A name that is already written normally survives unchanged, because
 * lowercasing and re-capitalising it lands back where it started.
 */
function presentable(name: string): string {
  return name
    .toLocaleLowerCase('es')
    .split(' ')
    .map((word) =>
      word.length === 0 ? word : word[0]!.toLocaleUpperCase('es') + word.slice(1),
    )
    .join(' ');
}

/** A non-empty trimmed string, or undefined. */
function text(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * PURE. The sections in a `/category` payload, in the order they arrived.
 *
 * Never throws, whatever the input.
 */
export function parseCategories(payload: unknown): NewsCategory[] {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return [];
  const rows = (payload as Record<string, unknown>).data;
  if (!Array.isArray(rows)) return [];

  const categories: NewsCategory[] = [];
  // The id is both what the filter is sent as and the React key: a duplicate
  // would make the chips ambiguous and the list collide with itself.
  const seen = new Set<string>();
  for (const row of rows) {
    if (typeof row !== 'object' || row === null) continue;
    const entry = row as Record<string, unknown>;
    const id = text(entry.id);
    const name = text(entry.name);
    if (id === undefined || name === undefined || seen.has(id)) continue;
    seen.add(id);
    categories.push({ id, name: presentable(name) });
  }
  return categories;
}
