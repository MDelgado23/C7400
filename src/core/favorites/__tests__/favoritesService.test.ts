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

import {
  setFavoritesProvider,
  __resetFavorites,
  getFavorites,
  isSaved,
  hasLoadedFavorites,
  subscribeToFavorites,
  saveArticle,
  removeArticle,
  type FavoritesProvider,
} from '../favoritesService';
import type { SavedArticle } from '../savedArticle';
import type { ArticleDetail } from '../../../features/news/newsMapping';

function user(uid: string, isAnonymous = false): AppUser {
  return { uid, email: null, displayName: null, isAnonymous, emailVerified: false };
}

function article(id = 'a-1'): ArticleDetail {
  return {
    id,
    title: 'Se viene el temporal',
    summary: 'Alerta amarilla.',
    publishedAt: '2026-08-19T10:00:00Z',
    paragraphs: ['Primer párrafo.'],
  };
}

function saved(id: string, savedAt: number): SavedArticle {
  return {
    id,
    title: `Nota ${id}`,
    summary: '',
    publishedAt: '2026-08-19T10:00:00Z',
    paragraphs: [],
    savedAt,
  };
}

type FakeProvider = FavoritesProvider & {
  save: jest.Mock;
  remove: jest.Mock;
  /** Pushes a list to whoever is currently subscribed. */
  emit: (uid: string, articles: SavedArticle[]) => void;
  /** uids the provider was asked to watch, in order. */
  watched: string[];
  unsubscribes: number;
};

function fakeProvider(): FakeProvider {
  const listeners = new Map<string, (articles: SavedArticle[]) => void>();
  const provider: FakeProvider = {
    save: jest.fn(async () => {}),
    remove: jest.fn(async () => {}),
    subscribe(uid: string, listener: (articles: SavedArticle[]) => void) {
      provider.watched.push(uid);
      listeners.set(uid, listener);
      return () => {
        provider.unsubscribes += 1;
        listeners.delete(uid);
      };
    },
    emit(uid, articles) {
      listeners.get(uid)?.(articles);
    },
    watched: [],
    unsubscribes: 0,
  };
  return provider;
}

beforeEach(() => {
  mockUser = null;
  emitUser = () => {};
  __resetFavorites();
  jest.restoreAllMocks();
});

describe('with nothing wired up', () => {
  it('reports an empty list instead of throwing', () => {
    expect(getFavorites()).toEqual([]);
    expect(isSaved('a-1')).toBe(false);
  });

  it('refuses to save, because the user asked for this one', () => {
    // Unlike the background sync below, a tap on "Guardar" is a request with
    // someone waiting on the answer.
    expect(() => saveArticle(article())).toThrow();
  });
});

describe('following the signed-in user', () => {
  it('watches the list of whoever is signed in', () => {
    mockUser = user('user-a');
    const provider = fakeProvider();

    setFavoritesProvider(provider);

    expect(provider.watched).toEqual(['user-a']);
  });

  it('works for an anonymous session, which is the whole point', () => {
    // Anonymous users have a uid, so saving works with no account at all. The
    // sign-up prompt exists to make the list SURVIVE a reinstall, not to
    // permit saving in the first place.
    mockUser = user('anon-1', true);
    const provider = fakeProvider();

    setFavoritesProvider(provider);
    provider.emit('anon-1', [saved('a-1', 10)]);

    expect(isSaved('a-1')).toBe(true);
  });

  it('EMPTIES the list the instant the user changes', () => {
    // A privacy boundary, not a refresh. Between signing in as someone else and
    // that person's list arriving, there must be no frame in which the previous
    // user's saved articles are on screen.
    mockUser = user('user-a');
    const provider = fakeProvider();
    setFavoritesProvider(provider);
    provider.emit('user-a', [saved('a-1', 10)]);
    expect(getFavorites()).toHaveLength(1);

    emitUser(user('user-b'));

    expect(getFavorites()).toEqual([]);
  });

  it('stops watching the previous user before watching the next', () => {
    mockUser = user('user-a');
    const provider = fakeProvider();
    setFavoritesProvider(provider);

    emitUser(user('user-b'));

    expect(provider.unsubscribes).toBe(1);
    expect(provider.watched).toEqual(['user-a', 'user-b']);
  });

  it('ignores a stale list from the user who just left', () => {
    // The old subscription may still deliver one last payload after the switch.
    // Accepting it would put the previous user's articles back on screen.
    mockUser = user('user-a');
    const provider = fakeProvider();
    setFavoritesProvider(provider);
    emitUser(user('user-b'));

    provider.emit('user-a', [saved('a-1', 10)]);

    expect(getFavorites()).toEqual([]);
  });

  it('does not re-subscribe when the same user is reported again', () => {
    // Auth re-reports the same session on things like an email verification.
    // Tearing the listener down and back up would blank the list for a frame
    // for no reason at all.
    mockUser = user('user-a');
    const provider = fakeProvider();
    setFavoritesProvider(provider);

    emitUser(user('user-a'));

    expect(provider.watched).toEqual(['user-a']);
  });

  it('clears everything on sign-out', () => {
    mockUser = user('user-a');
    const provider = fakeProvider();
    setFavoritesProvider(provider);
    provider.emit('user-a', [saved('a-1', 10)]);

    emitUser(null);

    expect(getFavorites()).toEqual([]);
    expect(provider.unsubscribes).toBe(1);
  });
});

describe('the list', () => {
  function wired() {
    mockUser = user('user-a');
    const provider = fakeProvider();
    setFavoritesProvider(provider);
    return provider;
  }

  it('is newest first, whatever order the provider used', () => {
    // The port owns this guarantee so it holds for every provider, and so a
    // repaired row with no timestamp sinks instead of leading.
    const provider = wired();

    provider.emit('user-a', [saved('old', 10), saved('new', 30), saved('mid', 20)]);

    expect(getFavorites().map((a) => a.id)).toEqual(['new', 'mid', 'old']);
  });

  it('answers isSaved from what is already in memory', () => {
    // Synchronous on purpose: the bookmark icon renders on every article card
    // and cannot await anything.
    const provider = wired();

    provider.emit('user-a', [saved('a-1', 10)]);

    expect(isSaved('a-1')).toBe(true);
    expect(isSaved('a-2')).toBe(false);
  });

  it('hands over the current list on subscribe, then every update', () => {
    // Unlike the auth port, this one ALWAYS delivers on subscribe — including
    // the empty list. The reference it hands out is stable, so React bails out
    // of the render and the simpler contract ("you always get the current
    // state") costs nothing.
    const provider = wired();
    const seen: SavedArticle[][] = [];
    subscribeToFavorites((articles) => seen.push(articles));

    provider.emit('user-a', [saved('a-1', 10)]);

    expect(seen.map((list) => list.map((a) => a.id))).toEqual([[], ['a-1']]);
  });

  it('hands a late subscriber what is already loaded', () => {
    const provider = wired();
    provider.emit('user-a', [saved('a-1', 10)]);

    const seen: SavedArticle[][] = [];
    subscribeToFavorites((articles) => seen.push(articles));

    expect(seen[0].map((a) => a.id)).toEqual(['a-1']);
  });

  it('stops notifying after unsubscribe', () => {
    const provider = wired();
    const listener = jest.fn();
    const unsubscribe = subscribeToFavorites(listener);
    listener.mockClear();

    unsubscribe();
    provider.emit('user-a', [saved('a-1', 10)]);

    expect(listener).not.toHaveBeenCalled();
  });

  it('never lets one throwing subscriber starve the others', () => {
    const provider = wired();
    const healthy = jest.fn();
    subscribeToFavorites(() => {
      throw new Error('screen exploded');
    });
    subscribeToFavorites(healthy);
    healthy.mockClear();

    expect(() => provider.emit('user-a', [saved('a-1', 10)])).not.toThrow();
    expect(healthy).toHaveBeenCalled();
  });
});

describe('knowing whether the list has arrived', () => {
  it('has not loaded before the provider reports', () => {
    // Without this the screen cannot tell "still fetching" from "you have not
    // saved anything", and every visit flashes the empty state before the list
    // appears.
    mockUser = user('user-a');
    setFavoritesProvider(fakeProvider());

    expect(hasLoadedFavorites()).toBe(false);
  });

  it('has loaded once the provider reports, even with nothing in it', () => {
    mockUser = user('user-a');
    const provider = fakeProvider();
    setFavoritesProvider(provider);

    provider.emit('user-a', []);

    expect(hasLoadedFavorites()).toBe(true);
  });

  it('goes back to not-loaded when the user changes', () => {
    // The new user's list has not arrived yet, and claiming it has would show
    // them "no guardaste nada" over someone else's absent data.
    mockUser = user('user-a');
    const provider = fakeProvider();
    setFavoritesProvider(provider);
    provider.emit('user-a', [saved('a-1', 10)]);

    emitUser(user('user-b'));

    expect(hasLoadedFavorites()).toBe(false);
  });

  it('counts as loaded when there is nobody signed in', () => {
    // Not a pending state: the answer is already known and final. Reporting it
    // as loading would spin forever if the anonymous session never came up.
    mockUser = null;
    setFavoritesProvider(fakeProvider());

    expect(hasLoadedFavorites()).toBe(true);
  });
});

describe('saving', () => {
  function wired() {
    mockUser = user('user-a');
    const provider = fakeProvider();
    setFavoritesProvider(provider);
    return provider;
  }

  it('stores the snapshot under the signed-in uid', () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    const provider = wired();

    saveArticle(article('a-9'));

    expect(provider.save).toHaveBeenCalledWith(
      'user-a',
      expect.objectContaining({ id: 'a-9', savedAt: 1_700_000_000_000 }),
    );
  });

  it('does not make the caller wait for the write', async () => {
    // With offline persistence the write can stay in flight for hours — until
    // the phone finds signal again. The bookmark fills from the LISTENER, which
    // fires from the local cache immediately, so nothing in the UI is allowed
    // to hang on this promise.
    const provider = wired();
    provider.save.mockReturnValue(new Promise(() => {}));

    expect(() => saveArticle(article())).not.toThrow();
  });

  it('swallows a write that ultimately fails', async () => {
    // Nothing the user can do about a rejected sync, and Firestore rolls the
    // local change back on its own — so the icon corrects itself. An unhandled
    // rejection here would be a crash in release.
    const provider = wired();
    provider.save.mockRejectedValue(new Error('permission denied'));

    expect(() => saveArticle(article())).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();
  });

  it('removes under the signed-in uid', () => {
    const provider = wired();

    removeArticle('a-9');

    expect(provider.remove).toHaveBeenCalledWith('user-a', 'a-9');
  });

  it('swallows a failed removal the same way', async () => {
    const provider = wired();
    provider.remove.mockRejectedValue(new Error('offline forever'));

    expect(() => removeArticle('a-9')).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();
  });

  it('refuses to save with nobody signed in', () => {
    mockUser = null;
    setFavoritesProvider(fakeProvider());

    expect(() => saveArticle(article())).toThrow();
  });
});
