import { parseSponsors, type Sponsor } from '../../../core/sponsors/sponsor';

/**
 * Fetches the sponsors document, conditionally.
 *
 * Thin impure glue, the same shape as `newsApi`: the transform is the pure
 * `parseSponsors` and everything here is the request around it.
 *
 * WHY ITS OWN DOCUMENT, AND NOT app-config.json. That one is the critical path
 * that keeps the radio on air — 223 bytes on a 4 second timeout at boot. Adding
 * the sponsors to it would mean every new local business invalidated the stream
 * config's etag, and every rotated stream port invalidated the sponsors'.
 * Separate documents, separate validators, separate lifecycles. The radio does
 * not find out that sponsors exist.
 */

/**
 * The document WE control, on the public repo's master branch. Editing it and
 * pushing changes the sponsors at runtime with NO rebuild (served through
 * raw.githubusercontent, ~5 min CDN cache).
 *
 * Verified against the live host: it serves an ETag and honours
 * If-None-Match with a 304 and an empty body.
 */
export const SPONSORS_URL =
  'https://raw.githubusercontent.com/MDelgado23/C7400/master/sponsors.json';

/**
 * Generous on purpose. Nothing is waiting on this: the cached grid is already
 * drawn, and this request runs behind it.
 */
const FETCH_TIMEOUT_MS = 8000;

export type SponsorsFetchResult =
  | { status: 'unchanged' }
  | { status: 'updated'; etag: string | null; sponsors: Sponsor[] };

/**
 * Whether a body is a sponsors document at all.
 *
 * The distinction this draws is the important one: `{ sponsors: [] }` is a
 * RADIO WITH NO SPONSORS, which is a thing that can legitimately happen and
 * must be applied. A string, an array, a renamed key — those are a botched
 * deploy, and reading them as "no sponsors any more" would cache an empty list
 * and empty the section on every launch after it.
 */
function isSponsorsDocument(body: unknown): boolean {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return false;
  return Array.isArray((body as Record<string, unknown>).sponsors);
}

/**
 * Asks whether the sponsors changed, and returns them when they did.
 *
 * Pass the etag from the cached snapshot to make the request conditional; an
 * unchanged document then comes back as a 304 with no body at all.
 *
 * THROWS on any failure — a bad status, a dead network, a malformed document.
 * That is deliberate and it is the whole safety property of this module: the
 * caller keeps showing what it has cached. Returning an empty list instead
 * would be written to the cache and would empty the section for good.
 */
export async function fetchSponsors(etag: string | null): Promise<SponsorsFetchResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(SPONSORS_URL, {
      signal: controller.signal,
      // Omitted entirely when there is nothing cached: an empty validator would
      // invite a 304 against a cache that does not exist.
      headers: etag === null ? {} : { 'If-None-Match': etag },
    });

    if (res.status === 304) return { status: 'unchanged' };
    if (!res.ok) throw new Error(`sponsors request failed: HTTP ${res.status}`);

    // Throws on a truncated body, which is the correct outcome — see above.
    const body: unknown = await res.json();
    if (!isSponsorsDocument(body)) throw new Error('sponsors document is malformed');

    return {
      status: 'updated',
      etag: res.headers.get('ETag'),
      sponsors: parseSponsors(body),
    };
  } finally {
    clearTimeout(timeout);
  }
}
