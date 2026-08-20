import type { Sponsor } from './sponsor';

/**
 * Sponsor channels → openable urls. PURE.
 *
 * THIS MODULE IS A SECURITY BOUNDARY, and it is worth being explicit about why.
 *
 * Sponsor entries come from `sponsors.json`, a document in a PUBLIC repo, and
 * the strings in them end up as the argument to `Linking.openURL` — a call that
 * hands a url to the operating system and asks it to act. On Android an
 * `intent://` url can start another application with attacker-chosen extras. So
 * a typo, or somebody with push access, must never be able to decide WHAT KIND
 * of thing gets opened.
 *
 * Hence the rule: THE DOCUMENT SUPPLIES THE HANDLE, THIS MODULE OWNS THE SCHEME.
 * `instagram` holds "fravega", never a url. The https://instagram.com/ prefix is
 * written here, in the binary, and the handle is reduced to a single path
 * segment and percent-encoded before it is interpolated. The worst a corrupted
 * document can achieve is a link to the wrong Instagram profile.
 *
 * `website` is the one field that genuinely is a url. It is already restricted
 * to https by `parseSponsors`, which is the same boundary enforced earlier.
 *
 * WHY https AND NOT instagram:// OR fb://
 *
 * The product requirement is "open the app if they have it, the browser if they
 * do not". An https url does BOTH on its own, through App Links (Android) and
 * Universal Links (iOS): the OS routes it to the app that has claimed the domain
 * and falls back to the browser when no app has. A custom scheme does neither —
 * it fails silently when the app is missing, needs a `<queries>` entry in the
 * manifest to be probed at all on Android 11+, and `fb://` additionally needs
 * the numeric page id rather than the username anybody can actually supply.
 */

export type SponsorLinkKind =
  | 'whatsapp'
  | 'phone'
  | 'instagram'
  | 'facebook'
  | 'website'
  | 'address';

export interface SponsorLink {
  kind: SponsorLinkKind;
  /** Button caption. */
  label: string;
  /** Handed to Linking.openURL as-is. Always https: or tel:. */
  url: string;
}

/**
 * Shortest thing that can still be a phone number.
 *
 * Deliberately permissive. Being too strict here silently hides a sponsor's
 * phone — the paid-for thing — while being too loose merely opens the dialer
 * with a number the user can read and abandon.
 */
const MIN_PHONE_DIGITS = 6;

/**
 * A profile handle, reduced to something safe to interpolate into a path.
 *
 * Two jobs. First, forgive the likeliest authoring mistake: pasting the full
 * profile url into a field documented as a handle. Query and fragment are
 * dropped and the last non-empty path segment is kept, so
 * `https://www.instagram.com/fravega/?igsh=x` yields `fravega`.
 *
 * Second, and this is the part that matters, percent-encode the result. That
 * neutralises anything left — a scheme, a slash, a traversal — and guarantees
 * the value can only ever be a single path segment on the host chosen here.
 */
function handle(raw: string): string | undefined {
  const path = raw.split(/[?#]/)[0] ?? '';
  const segment = path
    .split('/')
    .filter((part) => part.length > 0)
    .pop();
  const cleaned = segment?.replace(/^@+/, '').trim();
  return cleaned !== undefined && cleaned.length > 0 ? encodeURIComponent(cleaned) : undefined;
}

/** Every digit in the value, with a leading 00 international prefix removed. */
function digits(raw: string): string | undefined {
  const onlyDigits = raw.replace(/\D/g, '').replace(/^00/, '');
  return onlyDigits.length >= MIN_PHONE_DIGITS ? onlyDigits : undefined;
}

/** wa.me wants digits only, country code included, and no plus sign. */
function whatsappUrl(raw: string): string | undefined {
  const number = digits(raw);
  return number === undefined ? undefined : `https://wa.me/${number}`;
}

/**
 * A dialable tel: url.
 *
 * The + is preserved when the document wrote one (or wrote the 00 that stands
 * for it) and is NOT invented when it did not: prefixing a bare local number
 * with + would produce a number that dials nowhere.
 */
function phoneUrl(raw: string): string | undefined {
  const number = digits(raw);
  if (number === undefined) return undefined;
  const trimmed = raw.trim();
  const international = trimmed.startsWith('+') || trimmed.replace(/\D/g, '').startsWith('00');
  return international ? `tel:+${number}` : `tel:${number}`;
}

/**
 * A maps search both platforms resolve.
 *
 * The universal https form on purpose, rather than `geo:` (Android only) or
 * `maps:` (iOS only): it opens the maps app where one is installed and the
 * browser where none is, which is the same fallback every other link here gets.
 */
function addressUrl(raw: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(raw)}`;
}

/**
 * The channels of one sponsor, in the order they are shown.
 *
 * CONTACT first, PRESENCE second, LOCATION last. The audience of an AM station
 * in the interior writes and calls far more than it browses, so the button most
 * of them want is the one their thumb lands on.
 */
const BUILDERS: {
  kind: SponsorLinkKind;
  label: string;
  field: keyof Sponsor;
  toUrl: (raw: string) => string | undefined;
}[] = [
  { kind: 'whatsapp', label: 'WhatsApp', field: 'whatsapp', toUrl: whatsappUrl },
  { kind: 'phone', label: 'Llamar', field: 'phone', toUrl: phoneUrl },
  {
    kind: 'instagram',
    label: 'Instagram',
    field: 'instagram',
    toUrl: (raw) => {
      const name = handle(raw);
      return name === undefined ? undefined : `https://instagram.com/${name}`;
    },
  },
  {
    kind: 'facebook',
    label: 'Facebook',
    field: 'facebook',
    toUrl: (raw) => {
      const name = handle(raw);
      return name === undefined ? undefined : `https://facebook.com/${name}`;
    },
  },
  // Already https-checked by parseSponsors; nothing left to do but hand it over.
  { kind: 'website', label: 'Sitio web', field: 'website', toUrl: (raw) => raw },
  { kind: 'address', label: 'Cómo llegar', field: 'address', toUrl: addressUrl },
];

/**
 * PURE. The buttons to show for a sponsor, in a fixed order.
 *
 * A channel the sponsor does not have produces no button, and so does one whose
 * value cannot be turned into something openable — an empty row is better than
 * a button that does nothing when a listener taps it.
 */
export function buildSponsorLinks(sponsor: Sponsor): SponsorLink[] {
  const links: SponsorLink[] = [];
  for (const { kind, label, field, toUrl } of BUILDERS) {
    const raw = sponsor[field];
    if (typeof raw !== 'string') continue;
    const url = toUrl(raw);
    if (url !== undefined) links.push({ kind, label, url });
  }
  return links;
}
