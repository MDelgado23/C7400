import { parseSponsors, type Sponsor } from './sponsor';

/**
 * Sponsors cache port — provider-agnostic local persistence.
 *
 * Fifth port in the same shape as `observability`, `remoteConfig`, `authService`
 * and `favoritesService`: call sites depend on THIS module and the storage
 * vendor arrives through an adapter registered once at boot.
 *
 * WHAT MAKES THIS ONE DIFFERENT: NOTHING HERE IS ALLOWED TO FAIL LOUDLY.
 *
 * This cache exists so the grid is on screen before the network is consulted.
 * Every failure it can have — no adapter registered yet, a full disk, a corrupt
 * database, bytes written by an older build — has the same correct answer:
 * behave as though nothing was cached and let the fetch fill the screen. A
 * throw here would take down a section that had a perfectly good way to render.
 *
 * So reads answer `null` rather than raising, and writes are best-effort.
 */

export interface SponsorsSnapshot {
  /** Validator for the next conditional request, or null to fetch in full. */
  etag: string | null;
  sponsors: Sponsor[];
  /** When this was last confirmed fresh. 0 means "treat as very old". */
  fetchedAt: number;
}

/** What a storage adapter must implement. Deliberately tiny. */
export interface SponsorsStore {
  read(): Promise<unknown>;
  write(snapshot: SponsorsSnapshot): Promise<void>;
}

let store: SponsorsStore | null = null;

/** Registers the storage adapter. Called once at boot. */
export function setSponsorsStore(next: SponsorsStore): void {
  store = next;
}

/** Test hook — drops the adapter. */
export function __resetSponsorsCache(): void {
  store = null;
}

/**
 * Reads a cached snapshot, or null when there is nothing usable.
 *
 * WHAT COMES BACK IS RE-VALIDATED, and that is the point of doing it here. The
 * cached bytes were written by a PREVIOUS build: the shape may have moved under
 * them, or the write may have been cut off. They are no more trustworthy than
 * the network document, so they go through the SAME sanitiser — one rule about
 * what a sponsor is, in one place, whichever direction the data came from.
 *
 * Re-running `parseSponsors` does not disturb the order. The stored sponsors
 * carry no `pos` (it is consumed at parse time and never persisted), so they
 * all tie and fall back to array order — which is the order they were shown in.
 */
export async function readSnapshot(): Promise<SponsorsSnapshot | null> {
  if (store === null) return null;

  let raw: unknown;
  try {
    raw = await store.read();
  } catch {
    // A disk we cannot read is indistinguishable from a disk with nothing on
    // it, as far as what happens next is concerned.
    return null;
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const cached = raw as Record<string, unknown>;

  return {
    // A missing or malformed etag is not an error, it just means the next
    // request cannot be conditional. Losing the sponsors over it would be a far
    // worse trade than one full download of two kilobytes.
    etag: typeof cached.etag === 'string' ? cached.etag : null,
    sponsors: parseSponsors({ sponsors: cached.sponsors }),
    // 0 reads as "checked at the dawn of time", so `shouldRevalidate` says yes.
    // Any other answer would have to guess, and guessing wrong freezes the
    // section on stale data for the whole session.
    fetchedAt:
      typeof cached.fetchedAt === 'number' && Number.isFinite(cached.fetchedAt)
        ? cached.fetchedAt
        : 0,
  };
}

/**
 * Saves a snapshot for the next launch. Best-effort.
 *
 * A failure here is invisible on purpose: the sponsors are already on screen,
 * and all a lost write costs is a full fetch next time. There is nothing for a
 * listener to do about a full disk, and nothing worth reporting either — this
 * is not one of the silent failures the observability port exists to catch,
 * because the app carries on doing exactly what it was asked to.
 */
export async function writeSnapshot(snapshot: SponsorsSnapshot): Promise<void> {
  if (store === null) return;
  try {
    await store.write(snapshot);
  } catch {
    // Best-effort by design — see above.
  }
}
