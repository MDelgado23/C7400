/**
 * Event vocabulary and payload hygiene for app observability.
 *
 * PURE by design: Firebase Analytics silently DROPS events whose name or
 * parameters break its constraints — no throw, no warning, the event just never
 * arrives. That failure mode is invisible in production, which is exactly the
 * class of problem this module exists to catch, so the rules are enforced here
 * and unit-tested instead of trusted to the SDK.
 */

/**
 * The events this app reports. Deliberately small: these are the SILENT
 * failures — the ones that never throw, so Crashlytics would never see them.
 * A radio app that stops playing does not crash; it just goes quiet.
 */
export const EVENTS = {
  /** Engine reached real playback. The denominator every failure rate needs. */
  PLAYBACK_STARTED: 'playback_started',
  /** The live stream dropped. Carries the attempt count and whether we were online. */
  STREAM_DROP: 'stream_drop',
  /** Reconnect budget exhausted: the user's radio is dead and nothing threw. */
  STREAM_GIVE_UP: 'stream_give_up',
  /** POST_NOTIFICATIONS refused — the OS kills background audio without it. */
  NOTIF_PERMISSION_DENIED: 'notif_permission_denied',
  /** Battery-optimization exemption state: the root cause of screen-off drops. */
  BATTERY_EXEMPTION: 'battery_exemption',
  /** Remote config unreachable/invalid — the app is serving baked-in defaults. */
  CONFIG_FALLBACK_USED: 'config_fallback_used',
  /** A news article was opened from the feed. */
  ARTICLE_OPENED: 'article_opened',
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];

/** Analytics accepts strings and numbers; booleans are coerced (see below). */
export type EventParamValue = string | number | boolean;
export type EventParams = Record<string, EventParamValue>;

const MAX_NAME_LENGTH = 40;
const MAX_STRING_VALUE_LENGTH = 100;
const MAX_PARAMS = 25;
const NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;
/** Namespaces Firebase reserves for itself; events using them are rejected. */
const RESERVED_PREFIXES = ['firebase_', 'google_', 'ga_'];

/**
 * PURE. Whether a name is usable as an event or parameter name: 1-40 chars,
 * alphanumerics and underscores, starting with a letter, and outside Firebase's
 * reserved namespaces. Parameter names follow the same rules as event names.
 */
export function isValidEventName(name: string): boolean {
  if (name.length === 0 || name.length > MAX_NAME_LENGTH) return false;
  if (!NAME_PATTERN.test(name)) return false;
  const lower = name.toLowerCase();
  return !RESERVED_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

/**
 * PURE. Coerces a payload into something Analytics will actually accept:
 * invalid keys dropped, strings truncated to 100 chars, non-finite numbers
 * dropped, booleans stringified, and the whole thing capped at 25 parameters.
 *
 * Dropping a bad key beats dropping the whole event — a truncated report still
 * tells you the radio died.
 */
export function sanitizeParams(params: EventParams): EventParams {
  const clean: EventParams = {};
  for (const [key, value] of Object.entries(params)) {
    if (Object.keys(clean).length >= MAX_PARAMS) break;
    if (!isValidEventName(key)) continue;
    if (typeof value === 'string') {
      clean[key] = value.slice(0, MAX_STRING_VALUE_LENGTH);
    } else if (typeof value === 'number') {
      if (Number.isFinite(value)) clean[key] = value;
    } else if (typeof value === 'boolean') {
      // Analytics documents string/number only; stringify so the dashboard
      // shows `true`/`false` rather than a silently dropped parameter.
      clean[key] = value ? 'true' : 'false';
    }
    // Anything else is dropped. The types say this cannot happen, but payloads
    // are built from API responses that are typed and never validated, so an
    // absent field would otherwise be coerced and reported as `"false"` —
    // indistinguishable from real data, in the module whose job is to stop
    // exactly that.
  }
  return clean;
}
