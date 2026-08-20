import { resolveSponsorsStatus } from '../sponsorsStatus';

function ask(input: {
  hydrated?: boolean;
  fetching?: boolean;
  failed?: boolean;
  count?: number;
}): string {
  return resolveSponsorsStatus({
    hydrated: input.hydrated ?? true,
    fetching: input.fetching ?? false,
    failed: input.failed ?? false,
    count: input.count ?? 0,
  });
}

describe('resolveSponsorsStatus', () => {
  // THE RULE THAT OUTRANKS EVERY OTHER ONE. Sponsors on hand are drawn, full
  // stop. That is what the cache is for: from the second launch onward there is
  // no spinner, no error screen and no empty state, whatever the network is
  // doing behind it.
  describe('having sponsors beats everything', () => {
    it.each([
      ['while a revalidation is in flight', { fetching: true }],
      ['after the revalidation failed', { failed: true }],
      ['while both are true at once', { fetching: true, failed: true }],
    ])('is ready %s', (_label, state) => {
      expect(ask({ ...state, count: 9 })).toBe('ready');
    });
  });

  describe('with nothing to show yet', () => {
    // The cache read has not come back. Anything else would flash a state that
    // is about to be replaced a few milliseconds later.
    it('is loading before the cache has been read', () => {
      expect(ask({ hydrated: false })).toBe('loading');
    });

    it('is loading while the first fetch is in flight', () => {
      expect(ask({ fetching: true })).toBe('loading');
    });

    // Nothing cached AND the fetch failed: this is the only path to an error
    // screen, and it is the first launch on a dead network.
    it('is an error once the fetch has failed with nothing cached', () => {
      expect(ask({ failed: true })).toBe('error');
    });

    // The fetch succeeded and the radio genuinely has no sponsors. Distinct
    // from the error above: there is nothing to retry.
    it('is empty when the fetch succeeded and returned nobody', () => {
      expect(ask({})).toBe('empty');
    });
  });

  // A retry after a failure must not drop the user back to the error screen
  // they just tapped away from.
  it('goes back to loading when a failed fetch is retried', () => {
    expect(ask({ failed: true, fetching: true })).toBe('loading');
  });
});
