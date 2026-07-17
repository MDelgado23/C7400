/**
 * PURE: normalize a candidate artwork URI to something expo-audio can accept.
 *
 * expo-audio types `artworkUrl` as a Java `java.net.URL` on Android, so it MUST
 * have a scheme (http/https/file). Passing a scheme-less value — e.g. a bundled
 * asset id like "assets_logoam" — throws MalformedURLException and CRASHES the
 * app the moment setActiveForLockScreen runs from a UI event. This guard drops
 * anything that isn't a real URL so the crash can never happen.
 */
export function validArtworkUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  return /^(https?|file):\/\//i.test(url) ? url : undefined;
}
