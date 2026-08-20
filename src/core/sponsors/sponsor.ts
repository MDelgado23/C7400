/**
 * The sponsors model — PURE.
 *
 * These entries come from `sponsors.json`, a document that lives OUTSIDE the
 * binary in a public repo. Everything here treats that document as hostile
 * input: unknown shapes never throw, malformed entries are dropped rather than
 * rendered broken, and a bad document degrades the screen to "no sponsors"
 * instead of taking the app down.
 *
 * THE CENTRAL RULE — the document supplies the HANDLE, the app owns the SCHEME.
 *
 * Only `logoUrl` and `website` are URLs, and both are restricted to https. Every
 * other channel is stored as an IDENTITY ("fravega", a phone number) and the URL
 * is assembled by `buildSponsorLinks`. That is deliberate: these values end up
 * at `Linking.openURL`, and a raw string from a public document could otherwise
 * carry an `intent://` that launches another app with attacker-chosen extras.
 * With the scheme owned by the app, the worst a corrupted document can do is
 * point at the wrong Instagram account.
 */

/**
 * One sponsor, after sanitising. Optional fields are ABSENT, never undefined.
 *
 * NOTE there is no `pos` here even though the document carries one. It is read
 * to SORT and then dropped: two sources of ordering that can drift apart is the
 * same trap as a null with two meanings. Downstream, the array order is the
 * order, and there is no second opinion to consult.
 */
export interface Sponsor {
  id: string;
  name: string;
  /** https only — fed straight to <Image>. */
  logoUrl: string;
  description?: string;
  /** The one optional field that IS a URL. https only. */
  website?: string;
  /** Handle, without the leading @ (which is stripped when building the link). */
  instagram?: string;
  /** Page username or numeric id — both work in a facebook.com/<value> URL. */
  facebook?: string;
  /** Full international number; punctuation is normalised when building. */
  whatsapp?: string;
  phone?: string;
  /** Free text, geocoded by the maps app. */
  address?: string;
}

/** Optional fields carrying a handle or free text (everything but `website`). */
const HANDLE_FIELDS = [
  'description',
  'instagram',
  'facebook',
  'whatsapp',
  'phone',
  'address',
] as const;

/** A non-empty trimmed string, or undefined for anything else. */
function text(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * A trimmed https URL, or undefined.
 *
 * http:// is rejected as firmly as `javascript:`: iOS ATS and Android's
 * cleartext policy both block it, so an http logo renders as an empty box —
 * a silent failure, which is the class of bug this codebase refuses to ship.
 */
function httpsUrl(value: unknown): string | undefined {
  const url = text(value);
  return url !== undefined && url.startsWith('https://') ? url : undefined;
}

/**
 * The `pos` of an entry: a finite number, or undefined for anything else.
 *
 * NaN and Infinity are rejected along with strings and null. A NaN would poison
 * every comparison it takes part in (`NaN - 3` is NaN, which sorts as "equal"),
 * scrambling the order of sponsors that have nothing wrong with them.
 */
function position(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** One document entry → a Sponsor, or null when it cannot be rendered at all. */
function toSponsor(input: unknown): Sponsor | null {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return null;
  const entry = input as Record<string, unknown>;

  // Without any of these there is nothing to draw and nothing to attribute a
  // tap to, so the entry is dropped whole rather than shown as a broken tile.
  const id = text(entry.id);
  const name = text(entry.name);
  const logoUrl = httpsUrl(entry.logoUrl);
  if (id === undefined || name === undefined || logoUrl === undefined) return null;

  const sponsor: Sponsor = { id, name, logoUrl };

  // Assigned only when present: an `instagram: undefined` key would still make
  // `'instagram' in sponsor` true, and the link builder decides what to show by
  // asking exactly that.
  for (const field of HANDLE_FIELDS) {
    const value = text(entry[field]);
    if (value !== undefined) sponsor[field] = value;
  }
  const website = httpsUrl(entry.website);
  if (website !== undefined) sponsor.website = website;

  return sponsor;
}

/**
 * PURE. The sponsors in `sponsors.json`, in the order they should be shown.
 *
 * Order is the editorial decision — the top row is worth more than the bottom
 * one — so the document states it OUT LOUD with `pos` rather than leaving the
 * answer to "count the array".
 *
 * GAPS ARE THE POINT. Numbering 10/20/30 means slotting somebody between the
 * second and the third is one edit (25) instead of renumbering everyone below
 * them; consecutive 1/2/3 would make every reorder a rewrite of the whole file.
 * Nothing here requires the numbers to be consecutive, or to start at 1.
 *
 * Two entries sharing a `pos` fall back to document order, and an entry with no
 * usable `pos` sinks below every entry that has one: nobody placed it, so it
 * does not get to jump ahead of the ones somebody did.
 *
 * Never throws, whatever the input.
 */
export function parseSponsors(document: unknown): Sponsor[] {
  if (typeof document !== 'object' || document === null || Array.isArray(document)) return [];
  const entries = (document as Record<string, unknown>).sponsors;
  if (!Array.isArray(entries)) return [];

  const placed: { sponsor: Sponsor; pos: number | undefined; index: number }[] = [];
  // The id is both the React list key and the analytics dimension, so a
  // duplicate would warn on every render AND silently merge two sponsors' tap
  // counts into one — which is worse than dropping the row, because the number
  // still looks plausible. First one wins.
  const seen = new Set<string>();
  for (const entry of entries) {
    const sponsor = toSponsor(entry);
    if (sponsor === null || seen.has(sponsor.id)) continue;
    seen.add(sponsor.id);
    placed.push({
      sponsor,
      // Safe: toSponsor only returns non-null for a plain object.
      pos: position((entry as Record<string, unknown>).pos),
      index: placed.length,
    });
  }

  placed.sort((a, b) => {
    if (a.pos !== b.pos) {
      if (a.pos === undefined) return 1;
      if (b.pos === undefined) return -1;
      return a.pos - b.pos;
    }
    // Document order breaks every tie. Spelled out rather than leaning on the
    // engine's stable sort, so the guarantee is visible where it is relied upon.
    return a.index - b.index;
  });

  return placed.map((entry) => entry.sponsor);
}
