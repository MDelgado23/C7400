import {
  getAnalytics,
  logEvent as firebaseLogEvent,
  logScreenView as firebaseLogScreenView,
} from '@react-native-firebase/analytics';
import {
  getCrashlytics,
  log as firebaseLog,
  recordError as firebaseRecordError,
} from '@react-native-firebase/crashlytics';
import type { ObservabilitySink } from './observability';
import type { EventParams } from './events';

/**
 * Firebase adapter for the observability port.
 *
 * The ONLY module in the app that imports a Firebase SDK. Everything else calls
 * `trackEvent`/`trackScreen`/`trackError`, so swapping providers — or dropping
 * reporting entirely — means replacing this file and the one line that
 * registers it. Nothing here decides WHAT to report or validates it; the port
 * has already sanitized names and parameters by the time we are called.
 */

/**
 * Kills a promise the SDK hands back.
 *
 * The port guards every sink call in a try/catch, which catches a synchronous
 * throw and does exactly nothing for a rejected promise — that escapes as an
 * unhandled rejection, and in release React Native an unhandled rejection is a
 * crash. A radio that stops playing because its analytics SDK could not reach
 * the network is precisely what the port's hard invariant exists to prevent, so
 * the rejection has to die at the boundary.
 *
 * Checked at runtime rather than trusted from the types: the modular `logEvent`
 * is declared `void` but returns a thenable, so the declaration is no guarantee.
 */
function swallow(result: unknown): void {
  const thenable = result as { catch?: (onRejected: () => void) => unknown } | null;
  if (typeof thenable?.catch === 'function') thenable.catch(() => {});
}

export const firebaseSink: ObservabilitySink = {
  logEvent(name: string, params: EventParams): void {
    // Cast: the modular overload narrows the name against Analytics' reserved
    // event list at the type level, and our names are only known at runtime.
    // The port already rejects reserved prefixes before anything reaches here.
    swallow(firebaseLogEvent(getAnalytics(), name as 'custom_event', params));
  },

  logScreen(screenName: string): void {
    // Screen views are a distinct concept in Analytics, not a custom event —
    // reporting them through logEvent leaves the screen reports empty. There is
    // no separate class name in a JS-driven navigator, so both fields carry the
    // route name, which is what keeps the console's screen list readable.
    swallow(
      firebaseLogScreenView(getAnalytics(), {
        screen_name: screenName,
        screen_class: screenName,
      }),
    );
  },

  recordError(error: Error, context?: string): void {
    const crashlytics = getCrashlytics();
    // The breadcrumb goes FIRST so it is attached to the report that follows.
    // It is deliberately not passed as `recordError`'s `jsErrorName`: that
    // overwrites the error's own name, which is the field Crashlytics groups
    // issues by, and would collapse every context into one bucket while hiding
    // what actually threw.
    if (context) firebaseLog(crashlytics, context);
    firebaseRecordError(crashlytics, error);
  },
};
