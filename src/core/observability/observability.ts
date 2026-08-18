import {
  sanitizeParams,
  isValidEventName,
  type EventName,
  type EventParams,
} from './events';

/**
 * Observability port — provider-agnostic reporting for analytics and crashes.
 *
 * Design decision, mirroring `remoteConfig`: call sites depend on THIS module,
 * never on a vendor SDK. The Firebase adapter is registered once at boot via
 * `setObservabilitySink`; swapping providers (or disabling reporting entirely)
 * touches one file. Until an adapter is registered every call is a silent no-op,
 * so the app runs identically with or without Firebase wired up.
 *
 * HARD INVARIANT: reporting must never break the app. A radio that stops playing
 * because its analytics SDK threw is strictly worse than a radio with no
 * analytics, so every sink call is guarded — see `safely`.
 */

/** What a provider must implement. Deliberately tiny. */
export interface ObservabilitySink {
  logEvent(name: string, params: EventParams): void;
  /** Screen tracking is separate: providers have a dedicated API for it. */
  logScreen(screenName: string): void;
  /** A caught error worth reporting, with breadcrumb context. */
  recordError(error: Error, context?: string): void;
}

const noopSink: ObservabilitySink = {
  logEvent: () => {},
  logScreen: () => {},
  recordError: () => {},
};

let sink: ObservabilitySink = noopSink;

/** Register the provider adapter. Called once at boot. */
export function setObservabilitySink(next: ObservabilitySink): void {
  sink = next;
}

/** Test hook — restores the inert default. */
export function __resetObservability(): void {
  sink = noopSink;
}

/**
 * Runs a sink call, swallowing anything it throws. Nothing reported here is
 * worth a crash, and the reporter is the one component that cannot rely on
 * itself to tell us it failed.
 */
function safely(run: () => void): void {
  try {
    run();
  } catch {
    // Reporting is best-effort by definition.
  }
}

/** Report an app event. Invalid names are dropped rather than sent and lost. */
export function trackEvent(name: EventName, params: EventParams = {}): void {
  if (!isValidEventName(name)) return;
  safely(() => sink.logEvent(name, sanitizeParams(params)));
}

/** Report a screen view. */
export function trackScreen(screenName: string): void {
  if (screenName.length === 0) return;
  safely(() => sink.logScreen(screenName));
}

/**
 * Coerce a thrown value into a real Error without losing what it carried.
 *
 * `String(value)` on the shape that matters here — expo's native modules reject
 * with a plain `{ code, message }` — yields "[object Object]": a report with
 * none of the information it was added to capture, and with every such report
 * collapsing into one provider issue. The original is kept as `cause`.
 */
function toError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (typeof error === 'object' && error !== null) {
    const { code, message } = error as { code?: unknown; message?: unknown };
    if (typeof message === 'string' && message.length > 0) {
      const prefix = typeof code === 'string' && code.length > 0 ? `${code}: ` : '';
      return new Error(`${prefix}${message}`, { cause: error });
    }
  }
  return new Error(String(error), { cause: error });
}

/**
 * Report a caught error. For failures we handle but still want visibility on —
 * the ones that never reach a crash handler because we recovered from them.
 */
export function trackError(error: unknown, context?: string): void {
  // Inside `safely`: converting an exotic value (a symbol, a null-prototype
  // object) can itself throw, and the reporter is the one component that must
  // never be the reason something breaks.
  safely(() => sink.recordError(toError(error), context));
}
