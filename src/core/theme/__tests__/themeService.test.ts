import type { AppUser } from '../../auth/authService';

let emitUser: (user: AppUser | null) => void = () => {};
let mockUser: AppUser | null = null;

jest.mock('../../auth/authService', () => ({
  getCurrentUser: () => mockUser,
  subscribeToUser: (listener: (user: AppUser | null) => void) => {
    emitUser = (user) => {
      mockUser = user;
      listener(user);
    };
    if (mockUser !== null) listener(mockUser);
    return () => {
      emitUser = () => {};
    };
  },
}));

const mockTrackError = jest.fn();
jest.mock('../../observability/observability', () => ({
  trackError: (...args: unknown[]) => mockTrackError(...args),
}));

import {
  setThemeStore,
  setThemeSyncProvider,
  __resetTheme,
  getThemePreference,
  hasHydratedTheme,
  setThemePreference,
  subscribeToTheme,
  type ThemeStore,
  type ThemeSyncProvider,
} from '../themeService';
import { DEFAULT_THEME_PREFERENCE, type ThemePreference } from '../themePreference';

function user(uid: string, isAnonymous = false): AppUser {
  return { uid, email: null, displayName: null, isAnonymous, emailVerified: false };
}

type FakeStore = ThemeStore & { read: jest.Mock; write: jest.Mock };

function fakeStore(stored: unknown = null): FakeStore {
  return {
    read: jest.fn().mockResolvedValue(stored),
    write: jest.fn().mockResolvedValue(undefined),
  };
}

type FakeSync = ThemeSyncProvider & {
  write: jest.Mock;
  /** Pushes a raw account value to whoever is currently subscribed. */
  emit: (uid: string, raw: unknown) => void;
  /** uids the provider was asked to watch, in order. */
  watched: string[];
  unsubscribes: number;
};

function fakeSync(): FakeSync {
  const listeners = new Map<string, (raw: unknown) => void>();
  const provider: FakeSync = {
    write: jest.fn().mockResolvedValue(undefined),
    watched: [],
    unsubscribes: 0,
    subscribe(uid, listener) {
      provider.watched.push(uid);
      listeners.set(uid, listener);
      return () => {
        provider.unsubscribes += 1;
        listeners.delete(uid);
      };
    },
    emit(uid, raw) {
      listeners.get(uid)?.(raw);
    },
  };
  return provider;
}

/** Lets the store promises settle. Hydration is async by nature. */
const settle = () => new Promise<void>((resolve) => { setImmediate(() => resolve()); });

beforeEach(() => {
  mockUser = null;
  emitUser = () => {};
  mockTrackError.mockClear();
  __resetTheme();
});

afterEach(() => {
  __resetTheme();
});

describe('before anything has been read', () => {
  it('answers the default rather than nothing', () => {
    // Something has to be painted on the very first frame, and the port is read
    // synchronously during render. Answering null would push the decision into
    // every consumer.
    expect(getThemePreference()).toBe(DEFAULT_THEME_PREFERENCE);
  });

  it('says so, so the splash can hold', () => {
    // The difference between "dark because that is the default" and "dark
    // because you chose it" is a full repaint the user would watch happen.
    expect(hasHydratedTheme()).toBe(false);
  });
});

describe('the choice saved on this device', () => {
  it('is adopted at boot', async () => {
    setThemeStore(fakeStore('light'));
    await settle();

    expect(getThemePreference()).toBe('light');
    expect(hasHydratedTheme()).toBe(true);
  });

  it('leaves the default in place when there is nothing stored', async () => {
    setThemeStore(fakeStore(null));
    await settle();

    expect(getThemePreference()).toBe(DEFAULT_THEME_PREFERENCE);
    expect(hasHydratedTheme()).toBe(true);
  });

  it('ignores bytes written by another build', async () => {
    setThemeStore(fakeStore('Oscuro'));
    await settle();

    expect(getThemePreference()).toBe(DEFAULT_THEME_PREFERENCE);
  });

  it('still finishes hydrating when the disk cannot be read', async () => {
    // A half-written record an OS-killed app left behind. There is nothing to do
    // about it, and holding the splash forever over it is the one unacceptable
    // outcome.
    const store = fakeStore();
    store.read.mockRejectedValue(new Error('corrupt'));
    setThemeStore(store);
    await settle();

    expect(hasHydratedTheme()).toBe(true);
    expect(getThemePreference()).toBe(DEFAULT_THEME_PREFERENCE);
  });

  it('marks itself hydrated even with no device adapter at all', async () => {
    // Nothing will ever arrive, so waiting is waiting for good.
    setThemeSyncProvider(fakeSync());
    await settle();

    expect(hasHydratedTheme()).toBe(true);
  });
});

describe('choosing a theme', () => {
  it('takes effect immediately, before anything is written', async () => {
    setThemeStore(fakeStore());
    await settle();

    setThemePreference('light');

    // Synchronous on purpose: a tap that repaints one frame later reads as lag.
    expect(getThemePreference()).toBe('light');
  });

  it('tells every subscriber', async () => {
    setThemeStore(fakeStore());
    await settle();
    const seen: ThemePreference[] = [];
    subscribeToTheme((preference) => seen.push(preference));

    setThemePreference('system');

    expect(seen).toContain('system');
  });

  it('saves to the device', async () => {
    const store = fakeStore();
    setThemeStore(store);
    await settle();

    setThemePreference('light');

    expect(store.write).toHaveBeenCalledWith('light');
  });

  it('saves to the account of whoever is signed in', async () => {
    mockUser = user('u-1');
    const sync = fakeSync();
    setThemeStore(fakeStore());
    setThemeSyncProvider(sync);
    await settle();

    setThemePreference('light');

    expect(sync.write).toHaveBeenCalledWith('u-1', 'light');
  });

  it('saves to an anonymous account too', async () => {
    // Anonymous sessions have a real uid, and their preferences are as much
    // theirs as anyone else's. Same premise as favourites.
    mockUser = user('anon-1', true);
    const sync = fakeSync();
    setThemeStore(fakeStore());
    setThemeSyncProvider(sync);
    await settle();

    setThemePreference('light');

    expect(sync.write).toHaveBeenCalledWith('anon-1', 'light');
  });

  it('does not wait on either write, and does not revert when one fails', async () => {
    // Offline, the account write may not settle for hours. The theme is on
    // screen the moment it is tapped, and it stays there.
    const store = fakeStore();
    store.write.mockRejectedValue(new Error('disk full'));
    mockUser = user('u-1');
    const sync = fakeSync();
    sync.write.mockRejectedValue(new Error('offline'));
    setThemeStore(store);
    setThemeSyncProvider(sync);
    await settle();

    expect(() => setThemePreference('light')).not.toThrow();
    await settle();

    expect(getThemePreference()).toBe('light');
  });

  it('reports a failed write rather than swallowing it', async () => {
    // Nothing on screen says the sync failed, and a systematic failure here
    // means the security rules are wrong for everybody at once.
    const store = fakeStore();
    store.write.mockRejectedValue(new Error('disk full'));
    setThemeStore(store);
    await settle();

    setThemePreference('light');
    await settle();

    expect(mockTrackError).toHaveBeenCalledWith(expect.any(Error), 'theme.writeDevice');
  });

  it('works with nobody signed in', async () => {
    setThemeStore(fakeStore());
    setThemeSyncProvider(fakeSync());
    await settle();

    expect(() => setThemePreference('light')).not.toThrow();
    expect(getThemePreference()).toBe('light');
  });
});

describe('the choice saved in the account', () => {
  it('is watched once the session is known', async () => {
    const sync = fakeSync();
    setThemeStore(fakeStore());
    setThemeSyncProvider(sync);
    await settle();
    emitUser(user('u-1'));

    expect(sync.watched).toEqual(['u-1']);
  });

  it('wins over the device, because it followed the person here', async () => {
    // The point of the feature: change it on one phone, find it changed on the
    // other. The device copy is a cache, not the answer.
    const sync = fakeSync();
    setThemeStore(fakeStore('dark'));
    setThemeSyncProvider(sync);
    await settle();
    emitUser(user('u-1'));

    sync.emit('u-1', 'light');

    expect(getThemePreference()).toBe('light');
  });

  it('is mirrored to the device so the next cold boot starts right', async () => {
    // Without this the app opens on the cached theme and repaints once the
    // network answers - the flash the device cache exists to prevent.
    const store = fakeStore('dark');
    const sync = fakeSync();
    setThemeStore(store);
    setThemeSyncProvider(sync);
    await settle();
    emitUser(user('u-1'));

    sync.emit('u-1', 'light');

    expect(store.write).toHaveBeenCalledWith('light');
  });

  it('does not overwrite this device when the account holds nothing', async () => {
    // A user who set the theme before ever registering. An empty account is
    // "never chosen", not "chosen dark".
    const sync = fakeSync();
    setThemeStore(fakeStore('light'));
    setThemeSyncProvider(sync);
    await settle();
    emitUser(user('u-1'));

    sync.emit('u-1', null);

    expect(getThemePreference()).toBe('light');
  });

  it('is seeded from this device when the account holds nothing', async () => {
    // So the choice reaches the second phone without the user re-picking it.
    const sync = fakeSync();
    setThemeStore(fakeStore('light'));
    setThemeSyncProvider(sync);
    await settle();
    emitUser(user('u-1'));

    sync.emit('u-1', null);

    expect(sync.write).toHaveBeenCalledWith('u-1', 'light');
  });

  it('is not seeded from a device that never chose either', async () => {
    // Writing the default up would turn "no preference" into a preference, and
    // then automatic could never be inherited from another device.
    const sync = fakeSync();
    setThemeStore(fakeStore(null));
    setThemeSyncProvider(sync);
    await settle();
    emitUser(user('u-1'));

    sync.emit('u-1', null);

    expect(sync.write).not.toHaveBeenCalled();
  });

  it('ignores a document written by another build', async () => {
    const sync = fakeSync();
    setThemeStore(fakeStore('light'));
    setThemeSyncProvider(sync);
    await settle();
    emitUser(user('u-1'));

    sync.emit('u-1', 'Oscuro');

    expect(getThemePreference()).toBe('light');
  });
});

describe('when the session changes', () => {
  it('stops watching the account it was watching', async () => {
    const sync = fakeSync();
    setThemeStore(fakeStore());
    setThemeSyncProvider(sync);
    await settle();
    emitUser(user('u-1'));

    emitUser(user('u-2'));

    expect(sync.unsubscribes).toBe(1);
    expect(sync.watched).toEqual(['u-1', 'u-2']);
  });

  it('refuses a late report from the account it just left', async () => {
    // A cancelled subscription can still deliver one last payload, and adopting
    // it would put the previous person's theme on this person's screen.
    const sync = fakeSync();
    setThemeStore(fakeStore());
    setThemeSyncProvider(sync);
    await settle();
    emitUser(user('u-1'));
    const staleEmit = sync.emit;
    emitUser(user('u-2'));

    staleEmit('u-1', 'light');

    expect(getThemePreference()).toBe(DEFAULT_THEME_PREFERENCE);
  });

  it('keeps the theme on screen when the user signs out', async () => {
    // Signing out is not a request to change the way the app looks.
    const sync = fakeSync();
    setThemeStore(fakeStore());
    setThemeSyncProvider(sync);
    await settle();
    emitUser(user('u-1'));
    sync.emit('u-1', 'light');

    emitUser(null);

    expect(getThemePreference()).toBe('light');
  });
});

describe('subscribers', () => {
  it('are told the current preference the moment they arrive', async () => {
    setThemeStore(fakeStore('light'));
    await settle();
    const seen: ThemePreference[] = [];

    subscribeToTheme((preference) => seen.push(preference));

    expect(seen).toEqual(['light']);
  });

  it('stop hearing anything once they unsubscribe', async () => {
    setThemeStore(fakeStore());
    await settle();
    const seen: ThemePreference[] = [];
    const stop = subscribeToTheme((preference) => seen.push(preference));
    stop();

    setThemePreference('light');

    expect(seen).toEqual([DEFAULT_THEME_PREFERENCE]);
  });

  it('cannot take each other down', async () => {
    setThemeStore(fakeStore());
    await settle();
    const seen: ThemePreference[] = [];
    subscribeToTheme(() => {
      throw new Error('a screen with a bug in it');
    });
    subscribeToTheme((preference) => seen.push(preference));

    setThemePreference('light');

    expect(seen).toContain('light');
  });
});
