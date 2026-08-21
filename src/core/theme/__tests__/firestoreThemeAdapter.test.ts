/**
 * firestoreThemeAdapter tests.
 *
 * The adapter is one of only two modules in the app that know Firestore exists.
 * The SDK is mocked wholesale here, which also keeps its native module out of
 * the test run entirely.
 */

const mockDb = { __instance: 'firestore' };

const mockGetFirestore = jest.fn(() => mockDb);
const mockDoc = jest.fn((...args: unknown[]) => ({ __ref: 'doc', path: args.slice(1) }));
const mockSetDoc = jest.fn(() => Promise.resolve());
const mockOnSnapshot = jest.fn((...args: unknown[]) => {
  void args;
  return () => {};
});

jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: (...args: unknown[]) => mockGetFirestore(...(args as [])),
  doc: (...args: unknown[]) => mockDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...(args as [])),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...(args as [])),
}));

const mockTrackError = jest.fn();
jest.mock('../../observability/observability', () => ({
  trackError: (...args: unknown[]) => mockTrackError(...args),
}));

import { firestoreThemeProvider } from '../firestoreThemeAdapter';

/** A document snapshot that exists, carrying the given fields. */
function present(data: Record<string, unknown>) {
  return { exists: () => true, data: () => data };
}

/** A document snapshot for a path with nothing written at it. */
function absent() {
  return { exists: () => false, data: () => undefined };
}

/** Runs the snapshot handler `onSnapshot` was given. */
function emit(snapshot: unknown): void {
  const handler = mockOnSnapshot.mock.calls.at(-1)?.[1] as (value: unknown) => void;
  handler(snapshot);
}

/** Runs the error handler `onSnapshot` was given. */
function fail(error: unknown): void {
  const handler = mockOnSnapshot.mock.calls.at(-1)?.[2] as (value: unknown) => void;
  handler(error);
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('where the preference is kept', () => {
  it('is one settings document under the uid', () => {
    // The uid is IN THE PATH, which is what keeps the security rule to a single
    // comparison — the same shape the favourites subtree uses.
    firestoreThemeProvider.subscribe('u-1', () => {});

    expect(mockDoc).toHaveBeenCalledWith(mockDb, 'users', 'u-1', 'settings', 'preferences');
  });

  it('is the same document for reading and for writing', () => {
    firestoreThemeProvider.subscribe('u-1', () => {});
    const readPath = mockDoc.mock.calls.at(-1);
    void firestoreThemeProvider.write('u-1', 'light');
    const writePath = mockDoc.mock.calls.at(-1);

    expect(writePath).toEqual(readPath);
  });
});

describe('writing the preference', () => {
  it('saves it as a field, not as the whole document', () => {
    void firestoreThemeProvider.write('u-1', 'light');

    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.anything(),
      { theme: 'light' },
      expect.anything(),
    );
  });

  it('merges, so the next setting to land here is not deleted by this one', () => {
    // Not a nicety: a plain setDoc REPLACES the document. The day a second
    // preference lives beside this one, saving the theme would wipe it.
    void firestoreThemeProvider.write('u-1', 'light');

    expect(mockSetDoc).toHaveBeenCalledWith(expect.anything(), expect.anything(), {
      merge: true,
    });
  });

  it('hands the promise back unguarded, for the port to decide about', async () => {
    mockSetDoc.mockReturnValueOnce(Promise.reject(new Error('offline')));

    await expect(firestoreThemeProvider.write('u-1', 'light')).rejects.toThrow('offline');
  });
});

describe('following the account', () => {
  it('reports the stored value', () => {
    const seen: unknown[] = [];
    firestoreThemeProvider.subscribe('u-1', (raw) => seen.push(raw));

    emit(present({ theme: 'light' }));

    expect(seen).toEqual(['light']);
  });

  it('reports nothing for an account that never saved a preference', () => {
    // A missing document is a real answer — "never chosen" — and the port needs
    // it to seed the account from this device instead of overwriting it.
    const seen: unknown[] = [];
    firestoreThemeProvider.subscribe('u-1', (raw) => seen.push(raw));

    emit(absent());

    expect(seen).toEqual([undefined]);
  });

  it('reports nothing for a document with other settings but no theme', () => {
    const seen: unknown[] = [];
    firestoreThemeProvider.subscribe('u-1', (raw) => seen.push(raw));

    emit(present({ locale: 'es-AR' }));

    expect(seen).toEqual([undefined]);
  });

  it('hands the raw value over without judging it', () => {
    // Validation lives in `themePreference`, applied to BOTH stores. Doing it
    // here as well is how two answers to the same question start to drift.
    const seen: unknown[] = [];
    firestoreThemeProvider.subscribe('u-1', (raw) => seen.push(raw));

    emit(present({ theme: 42 }));

    expect(seen).toEqual([42]);
  });

  it('gives back a way to stop listening', () => {
    const stop = jest.fn();
    mockOnSnapshot.mockReturnValueOnce(stop);

    firestoreThemeProvider.subscribe('u-1', () => {})();

    expect(stop).toHaveBeenCalled();
  });

  it('reports a listener that dies rather than freezing in silence', () => {
    // A denied read stops delivery with nothing on screen to say so, and the
    // likely cause — wrong security rules — hits everybody at once.
    firestoreThemeProvider.subscribe('u-1', () => {});

    fail(new Error('permission-denied'));

    expect(mockTrackError).toHaveBeenCalledWith(expect.any(Error), 'theme.subscribe');
  });
});
