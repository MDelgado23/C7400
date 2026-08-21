/**
 * The public web address of a note — PURE.
 *
 * THE API DOES NOT SEND A URL. Its `url` field holds a PATH —
 * `/locales/aoma-inicia-medidas-gremiales` — and the app has always mapped it
 * straight into a field called `webUrl`, stored it under that name in Firestore
 * on every saved note, and never opened it. The day something does, a path
 * handed to `Linking.openURL` goes nowhere.
 *
 * That is the same trap the sponsors' links were built to avoid, so this is the
 * same boundary: THE APP DECIDES THE SCHEME, and a value off the wire never
 * does. Only https survives, and only on the station's own site.
 */

/**
 * PURE. An absolute https url for a note, or undefined when there is nothing
 * safe to build.
 *
 * Undefined rather than a best guess: the caller's only use for this is a link,
 * and a link that cannot be trusted is better absent than present and broken.
 */
export function absoluteArticleUrl(path: string | undefined, siteBase: string): string | undefined {
  const trimmed = path?.trim();
  if (trimmed === undefined || trimmed.length === 0) return undefined;

  const base = siteBase.trim().replace(/\/+$/, '');
  if (base.length === 0 || !base.startsWith('https://')) return undefined;

  // Already a full address: accepted only if it is https. An http one is not
  // "nearly right" — iOS ATS and Android's cleartext policy both refuse it.
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    return trimmed.startsWith('https://') ? trimmed : undefined;
  }

  // A protocol-relative path (`//evil.com/x`) would resolve against whatever
  // scheme is in play and land on a host nobody chose. Its leading slashes are
  // collapsed so it stays a path on the station's own site.
  const relative = `/${trimmed.replace(/^\/+/, '')}`;

  try {
    // Resolved through URL rather than concatenated, so a traversal is
    // normalised away instead of being carried into the address as-is.
    const resolved = new URL(relative, `${base}/`);
    return resolved.protocol === 'https:' ? resolved.toString() : undefined;
  } catch {
    return undefined;
  }
}
