/**
 * firebaseSink tests.
 *
 * The adapter is the ONLY module that knows Firebase exists. Both SDKs are
 * mocked wholesale here, which also keeps their native modules out of the test
 * run entirely.
 */

const mockAnalytics = { __instance: 'analytics' };
const mockCrashlytics = { __instance: 'crashlytics' };

const mockGetAnalytics = jest.fn(() => mockAnalytics);
const mockLogEvent = jest.fn();
const mockLogScreenView = jest.fn<Promise<void>, unknown[]>(() => Promise.resolve());

const mockGetCrashlytics = jest.fn(() => mockCrashlytics);
const mockRecordError = jest.fn();
const mockLog = jest.fn();

jest.mock('@react-native-firebase/analytics', () => ({
  getAnalytics: (...args: unknown[]) => mockGetAnalytics(...(args as [])),
  logEvent: (...args: unknown[]) => mockLogEvent(...args),
  logScreenView: (...args: unknown[]) => mockLogScreenView(...args),
}));

jest.mock('@react-native-firebase/crashlytics', () => ({
  getCrashlytics: (...args: unknown[]) => mockGetCrashlytics(...(args as [])),
  recordError: (...args: unknown[]) => mockRecordError(...args),
  log: (...args: unknown[]) => mockLog(...args),
}));

import { firebaseSink } from '../firebaseSink';

beforeEach(() => {
  jest.clearAllMocks();
  mockLogScreenView.mockImplementation(() => Promise.resolve());
});

describe('logEvent', () => {
  it('forwards the name and parameters against the analytics instance', () => {
    firebaseSink.logEvent('stream_give_up', { attempt: 8 });

    expect(mockLogEvent).toHaveBeenCalledWith(mockAnalytics, 'stream_give_up', {
      attempt: 8,
    });
  });

  it('forwards an empty payload as an empty object', () => {
    firebaseSink.logEvent('playback_started', {});

    expect(mockLogEvent).toHaveBeenCalledWith(mockAnalytics, 'playback_started', {});
  });
});

describe('logScreen', () => {
  it('reports the screen through the dedicated screen-view API', () => {
    // Analytics treats screen views as their own concept, not a custom event —
    // sending them as `logEvent` would leave the screen reports empty.
    firebaseSink.logScreen('Radio');

    expect(mockLogScreenView).toHaveBeenCalledWith(mockAnalytics, {
      screen_name: 'Radio',
      screen_class: 'Radio',
    });
  });
});

describe('recordError', () => {
  it('records the error itself and leaves its name intact', () => {
    const error = new Error('stream failed');

    firebaseSink.recordError(error, 'pushLockScreen');

    // The context is NOT passed as `jsErrorName`: that overwrites the error's
    // own name, which is the field the provider groups issues by. It goes in as
    // a breadcrumb instead, which is what the port documents it as.
    expect(mockRecordError).toHaveBeenCalledWith(mockCrashlytics, error);
    expect(mockLog).toHaveBeenCalledWith(mockCrashlytics, 'pushLockScreen');
  });

  it('records an error with no context without logging an empty breadcrumb', () => {
    const error = new Error('boom');

    firebaseSink.recordError(error);

    expect(mockRecordError).toHaveBeenCalledWith(mockCrashlytics, error);
    expect(mockLog).not.toHaveBeenCalled();
  });
});

describe('resilience', () => {
  it('swallows a rejected SDK promise instead of leaking an unhandled rejection', async () => {
    // `logScreenView` returns a Promise. The port guards sink calls with a
    // try/catch, which catches a synchronous throw and does NOTHING for a
    // rejected promise — that escapes as an unhandled rejection and, in release
    // React Native, that is a crash. The hard invariant of the port is that
    // reporting can never break the app, so the promise has to die here.
    mockLogScreenView.mockImplementation(() => Promise.reject(new Error('SDK down')));
    const unhandled = jest.fn();
    process.on('unhandledRejection', unhandled);

    expect(() => firebaseSink.logScreen('Radio')).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();

    process.off('unhandledRejection', unhandled);
    expect(unhandled).not.toHaveBeenCalled();
  });

  it('swallows a rejection from a logEvent that returns a promise', async () => {
    // Typed `void`, but the runtime returns a thenable, so the same hazard
    // applies and the declared type is no protection.
    mockLogEvent.mockImplementation(() => Promise.reject(new Error('SDK down')));
    const unhandled = jest.fn();
    process.on('unhandledRejection', unhandled);

    expect(() => firebaseSink.logEvent('stream_drop', { attempt: 1 })).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();

    process.off('unhandledRejection', unhandled);
    expect(unhandled).not.toHaveBeenCalled();
  });
});
