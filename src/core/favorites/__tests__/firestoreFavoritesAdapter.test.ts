/**
 * firestoreFavoritesAdapter tests.
 *
 * The adapter is the ONLY module in the app that knows Firestore exists. The
 * SDK is mocked wholesale here, which also keeps its native module out of the
 * test run entirely.
 */

const mockDb = { __instance: 'firestore' };

const mockGetFirestore = jest.fn(() => mockDb);
const mockDoc = jest.fn((...args: unknown[]) => ({ __ref: 'doc', path: args.slice(1) }));
const mockCollection = jest.fn((...args: unknown[]) => ({
  __ref: 'collection',
  path: args.slice(1),
}));
const mockQuery = jest.fn((ref: unknown, ...constraints: unknown[]) => ({
  __ref: 'query',
  ref,
  constraints,
}));
const mockOrderBy = jest.fn((field: string, dir?: string) => ({ __orderBy: field, dir }));
const mockSetDoc = jest.fn(() => Promise.resolve());
const mockDeleteDoc = jest.fn(() => Promise.resolve());
const mockOnSnapshot = jest.fn(() => () => {});

jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: (...args: unknown[]) => mockGetFirestore(...(args as [])),
  doc: (...args: unknown[]) => mockDoc(...args),
  collection: (...args: unknown[]) => mockCollection(...args),
  query: (...args: unknown[]) => mockQuery(args[0], ...args.slice(1)),
  orderBy: (...args: unknown[]) => mockOrderBy(...(args as [string, string?])),
  setDoc: (...args: unknown[]) => mockSetDoc(...(args as [])),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...(args as [])),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...(args as [])),
}));

const mockTrackError = jest.fn();
jest.mock('../../observability/observability', () => ({
  trackError: (...args: unknown[]) => mockTrackError(...args),
}));

import { firestoreFavoritesProvider } from '../firestoreFavoritesAdapter';
import type { SavedArticle } from '../savedArticle';

function saved(id = 'a-1'): SavedArticle {
  return {
    id,
    title: 'Se viene el temporal',
    summary: 'Alerta amarilla.',
    publishedAt: '2026-08-19T10:00:00Z',
    paragraphs: ['Primer párrafo.'],
    savedAt: 1_700_000_000_000,
  };
}

/** A Firestore query snapshot carrying the given document payloads. */
function snapshot(...payloads: unknown[]) {
  return { docs: payloads.map((data) => ({ data: () => data })) };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockOnSnapshot.mockReturnValue(() => {});
});

describe('save', () => {
  it('writes under the user, keyed by the article id', () => {
    firestoreFavoritesProvider.save('user-a', saved('a-9'));

    // The article id IS the document id, which makes saving twice idempotent
    // instead of leaving two rows for the same note.
    expect(mockDoc).toHaveBeenCalledWith(mockDb, 'users', 'user-a', 'favorites', 'a-9');
    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.objectContaining({ __ref: 'doc' }),
      saved('a-9'),
    );
  });

  it('hands back the write promise so the port can attach its own catch', async () => {
    await expect(firestoreFavoritesProvider.save('user-a', saved())).resolves.toBeUndefined();
  });
});

describe('remove', () => {
  it('deletes the document for that article', () => {
    firestoreFavoritesProvider.remove('user-a', 'a-9');

    expect(mockDoc).toHaveBeenCalledWith(mockDb, 'users', 'user-a', 'favorites', 'a-9');
    expect(mockDeleteDoc).toHaveBeenCalled();
  });
});

describe('subscribe', () => {
  it('watches that user collection, newest first', () => {
    firestoreFavoritesProvider.subscribe('user-a', () => {});

    expect(mockCollection).toHaveBeenCalledWith(mockDb, 'users', 'user-a', 'favorites');
    expect(mockOrderBy).toHaveBeenCalledWith('savedAt', 'desc');
  });

  it('maps stored documents into saved articles', () => {
    const seen: SavedArticle[][] = [];
    firestoreFavoritesProvider.subscribe('user-a', (articles) => seen.push(articles));

    const [, onNext] = mockOnSnapshot.mock.calls[0] as unknown as [
      unknown,
      (s: ReturnType<typeof snapshot>) => void,
    ];
    onNext(snapshot(saved('a-1'), saved('a-2')));

    expect(seen[0].map((a) => a.id)).toEqual(['a-1', 'a-2']);
  });

  it('drops an unreadable document instead of losing the whole list', () => {
    // A row written by an older build, a half-finished write, or a hand edit in
    // the console would otherwise take every saved article down with it.
    const seen: SavedArticle[][] = [];
    firestoreFavoritesProvider.subscribe('user-a', (articles) => seen.push(articles));

    const [, onNext] = mockOnSnapshot.mock.calls[0] as unknown as [
      unknown,
      (s: ReturnType<typeof snapshot>) => void,
    ];
    onNext(snapshot(saved('a-1'), { title: 'sin id' }, saved('a-2')));

    expect(seen[0].map((a) => a.id)).toEqual(['a-1', 'a-2']);
  });

  it('reports a listener failure rather than dying silently', () => {
    // A listener that errors — a rules change denying reads, most likely —
    // simply stops delivering. With no error handler the list would freeze at
    // whatever it last showed, with nothing anywhere saying why.
    firestoreFavoritesProvider.subscribe('user-a', () => {});

    const [, , onError] = mockOnSnapshot.mock.calls[0] as unknown as [
      unknown,
      unknown,
      (e: Error) => void,
    ];
    const failure = new Error('permission-denied');
    expect(() => onError(failure)).not.toThrow();

    expect(mockTrackError).toHaveBeenCalledWith(failure, expect.any(String));
  });

  it('returns the unsubscribe the SDK gave it', () => {
    const unsubscribe = jest.fn();
    mockOnSnapshot.mockReturnValue(unsubscribe);

    firestoreFavoritesProvider.subscribe('user-a', () => {})();

    expect(unsubscribe).toHaveBeenCalled();
  });
});
