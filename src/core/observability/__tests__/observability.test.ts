import {
  setObservabilitySink,
  __resetObservability,
  trackEvent,
  trackScreen,
  trackError,
  type ObservabilitySink,
} from '../observability';
import { EVENTS } from '../events';

function fakeSink(): ObservabilitySink & {
  logEvent: jest.Mock;
  logScreen: jest.Mock;
  recordError: jest.Mock;
} {
  return { logEvent: jest.fn(), logScreen: jest.fn(), recordError: jest.fn() };
}

beforeEach(() => {
  __resetObservability();
});

describe('with no adapter registered', () => {
  it('is a silent no-op so the app runs identically without a provider', () => {
    expect(() => {
      trackEvent(EVENTS.STREAM_GIVE_UP, { attempt: 8 });
      trackScreen('Radio');
      trackError(new Error('boom'));
    }).not.toThrow();
  });
});

describe('trackEvent', () => {
  it('forwards the event with sanitized parameters', () => {
    const sink = fakeSink();
    setObservabilitySink(sink);

    trackEvent(EVENTS.STREAM_DROP, { attempt: 2, online: true, 'bad-key': 1 });

    expect(sink.logEvent).toHaveBeenCalledWith(EVENTS.STREAM_DROP, {
      attempt: 2,
      online: 'true',
    });
  });

  it('sends an empty payload when no parameters are given', () => {
    const sink = fakeSink();
    setObservabilitySink(sink);

    trackEvent(EVENTS.PLAYBACK_STARTED);

    expect(sink.logEvent).toHaveBeenCalledWith(EVENTS.PLAYBACK_STARTED, {});
  });
});

describe('trackError', () => {
  it('wraps a non-Error value so the provider always gets a real Error', () => {
    const sink = fakeSink();
    setObservabilitySink(sink);

    trackError('just a string', 'audio');

    const [error, context] = sink.recordError.mock.calls[0];
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('just a string');
    expect(context).toBe('audio');
  });

  it('passes a real Error through untouched', () => {
    const sink = fakeSink();
    setObservabilitySink(sink);
    const original = new Error('stream failed');

    trackError(original);

    expect(sink.recordError).toHaveBeenCalledWith(original, undefined);
  });
});

describe('resilience', () => {
  it('never lets a throwing provider reach the caller', () => {
    // The hard invariant: a radio that stops playing because its analytics SDK
    // threw is strictly worse than a radio with no analytics at all.
    setObservabilitySink({
      logEvent: () => {
        throw new Error('SDK exploded');
      },
      logScreen: () => {
        throw new Error('SDK exploded');
      },
      recordError: () => {
        throw new Error('SDK exploded');
      },
    });

    expect(() => trackEvent(EVENTS.PLAYBACK_STARTED)).not.toThrow();
    expect(() => trackScreen('Radio')).not.toThrow();
    expect(() => trackError(new Error('boom'))).not.toThrow();
  });

  it('ignores an empty screen name', () => {
    const sink = fakeSink();
    setObservabilitySink(sink);

    trackScreen('');

    expect(sink.logScreen).not.toHaveBeenCalled();
  });
});
