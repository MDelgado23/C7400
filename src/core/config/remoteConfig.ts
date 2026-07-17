/**
 * RemoteConfig — provider-agnostic app configuration.
 *
 * Design decision: the live stream URL is NOT hardcoded into the binary.
 * radiosnethosting can rotate the port (currently 9966); if that value lived
 * in the bundle we'd need a full store re-submission (and Apple review) just to
 * keep the radio on air. Instead we fetch an override JSON at runtime and fall
 * back to sane defaults when it's unavailable or malformed.
 *
 * v1 uses a lightweight fetch-based provider. It can be swapped for Firebase
 * Remote Config later without touching call sites — the contract is this module.
 */

export interface AppConfig {
  /** Live radio stream (audio/mpeg over HTTPS — iOS ATS friendly). */
  streamUrl: string;
  /** Base URL for the Tadevel content API (news). */
  newsApiBase: string;
  /** Station badge, used as the lock-screen / media-notification artwork. Must
   *  be a real HTTPS URL — expo-audio rejects scheme-less/bundled values. */
  stationLogoUrl: string;
}

/** Baked-in defaults. Verified working as of 2026-07-10. */
const FALLBACK_CONFIG: AppConfig = {
  streamUrl: 'https://ssl.radiosnethosting.com/index.php?port=9966',
  newsApiBase: 'https://flex-app.tadevel-cdn.com/hostname/lu32.com.ar/api/v1',
  stationLogoUrl: 'https://i.ibb.co/1YPnKXrf/logo-am.png',
};

/**
 * Optional override document the station controls. If it 404s or is invalid,
 * we silently use FALLBACK_CONFIG — the app must never fail to boot over config.
 */
const REMOTE_CONFIG_URL =
  'https://flex-app.tadevel-cdn.com/hostname/lu32.com.ar/app-config.json';

const FETCH_TIMEOUT_MS = 4000;

let cached: AppConfig | null = null;

/** Keep only known string keys so a malformed remote doc can't inject junk. */
function sanitize(input: unknown): Partial<AppConfig> {
  if (typeof input !== 'object' || input === null) return {};
  const data = input as Record<string, unknown>;
  const out: Partial<AppConfig> = {};
  if (typeof data.streamUrl === 'string' && data.streamUrl.startsWith('https://')) {
    out.streamUrl = data.streamUrl;
  }
  if (typeof data.newsApiBase === 'string' && data.newsApiBase.startsWith('https://')) {
    out.newsApiBase = data.newsApiBase;
  }
  if (typeof data.stationLogoUrl === 'string' && data.stationLogoUrl.startsWith('https://')) {
    out.stationLogoUrl = data.stationLogoUrl;
  }
  return out;
}

/**
 * Loads config, merging any valid remote override over the fallback.
 * Result is cached for the session. Never throws.
 */
export async function loadRemoteConfig(): Promise<AppConfig> {
  if (cached) return cached;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(REMOTE_CONFIG_URL, { signal: controller.signal });
    if (!res.ok) throw new Error(`config HTTP ${res.status}`);
    const remote = sanitize(await res.json());
    cached = { ...FALLBACK_CONFIG, ...remote };
  } catch {
    cached = FALLBACK_CONFIG;
  } finally {
    clearTimeout(timeout);
  }
  return cached;
}

/** Synchronous defaults, for code paths that can't await (or tests). */
export function getFallbackConfig(): AppConfig {
  return FALLBACK_CONFIG;
}

/** Test hook — clears the session cache. */
export function __resetRemoteConfigCache(): void {
  cached = null;
}
