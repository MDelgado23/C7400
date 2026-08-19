/**
 * firebaseAuthAdapter tests.
 *
 * The adapter is the ONLY module in the app that knows Firebase Auth exists.
 * The SDK is mocked wholesale here, which also keeps its native module out of
 * the test run entirely.
 */

const mockAuth = { __instance: 'auth', currentUser: null as unknown };

const mockGetAuth = jest.fn(() => mockAuth);
const mockSignInAnonymously = jest.fn();
const mockCreateUser = jest.fn();
const mockSignIn = jest.fn();
const mockLinkWithCredential = jest.fn();
const mockReauthenticate = jest.fn();
const mockUpdatePassword = jest.fn();
const mockSendPasswordResetEmail = jest.fn();
const mockSignOut = jest.fn();
const mockOnAuthStateChanged = jest.fn();
const mockEmailCredential = jest.fn((email: string, password: string) => ({
  __credential: 'email',
  email,
  password,
}));

jest.mock('@react-native-firebase/auth', () => ({
  getAuth: (...args: unknown[]) => mockGetAuth(...(args as [])),
  signInAnonymously: (...args: unknown[]) => mockSignInAnonymously(...args),
  createUserWithEmailAndPassword: (...args: unknown[]) => mockCreateUser(...args),
  signInWithEmailAndPassword: (...args: unknown[]) => mockSignIn(...args),
  linkWithCredential: (...args: unknown[]) => mockLinkWithCredential(...args),
  reauthenticateWithCredential: (...args: unknown[]) => mockReauthenticate(...args),
  updatePassword: (...args: unknown[]) => mockUpdatePassword(...args),
  sendPasswordResetEmail: (...args: unknown[]) => mockSendPasswordResetEmail(...args),
  signOut: (...args: unknown[]) => mockSignOut(...args),
  onAuthStateChanged: (...args: unknown[]) => mockOnAuthStateChanged(...args),
  EmailAuthProvider: {
    credential: (email: string, password: string) => mockEmailCredential(email, password),
  },
}));

import { firebaseAuthProvider } from '../firebaseAuthAdapter';

/** A Firebase user, with the vendor-only fields the domain must never see. */
function firebaseUser(overrides: Record<string, unknown> = {}) {
  return {
    uid: 'uid-1',
    email: 'martin@gmail.com',
    displayName: 'Martin',
    isAnonymous: false,
    emailVerified: true,
    // Everything below is the reason the mapping exists.
    refreshToken: 'super-secret-refresh-token',
    providerData: [{ providerId: 'password' }],
    metadata: { creationTime: 'x' },
    tenantId: null,
    multiFactor: null,
    delete: jest.fn(),
    getIdToken: jest.fn(),
    toJSON: jest.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.currentUser = null;
  mockSignInAnonymously.mockResolvedValue({ user: firebaseUser({ isAnonymous: true }) });
  mockCreateUser.mockResolvedValue({ user: firebaseUser() });
  mockSignIn.mockResolvedValue({ user: firebaseUser() });
  mockLinkWithCredential.mockResolvedValue({ user: firebaseUser() });
  mockReauthenticate.mockResolvedValue({ user: firebaseUser() });
  mockUpdatePassword.mockResolvedValue(undefined);
  mockSendPasswordResetEmail.mockResolvedValue(undefined);
  mockSignOut.mockResolvedValue(undefined);
  mockOnAuthStateChanged.mockReturnValue(() => {});
});

describe('user mapping', () => {
  it('exposes exactly the fields the domain defines', async () => {
    // The guard against the vendor leaking through the port: a screen that can
    // reach `refreshToken` or `delete()` is a screen coupled to Firebase, and
    // the adapter is the only place that coupling can be stopped.
    const user = await firebaseAuthProvider.signInAnonymously();

    expect(Object.keys(user).sort()).toEqual([
      'displayName',
      'email',
      'emailVerified',
      'isAnonymous',
      'uid',
    ]);
  });

  it('carries the values across', async () => {
    const user = await firebaseAuthProvider.signInWithEmail('martin@gmail.com', 'supersecreta');

    expect(user).toEqual({
      uid: 'uid-1',
      email: 'martin@gmail.com',
      displayName: 'Martin',
      isAnonymous: false,
      emailVerified: true,
    });
  });

  it('normalizes absent optional fields to null', async () => {
    // Native hands back `undefined` where the web SDK types promise `null`.
    // Left alone, `displayName === null` checks in the UI would quietly miss.
    mockSignIn.mockResolvedValue({
      user: firebaseUser({ email: undefined, displayName: undefined }),
    });

    const user = await firebaseAuthProvider.signInWithEmail('martin@gmail.com', 'supersecreta');

    expect(user.email).toBeNull();
    expect(user.displayName).toBeNull();
  });

  it('treats a missing isAnonymous as anonymous rather than registered', async () => {
    // Failing the other way would let the UI offer "upgrade your account" to a
    // registered user, or worse, hide it from someone who needs it.
    mockSignInAnonymously.mockResolvedValue({ user: firebaseUser({ isAnonymous: undefined }) });

    const user = await firebaseAuthProvider.signInAnonymously();

    expect(user.isAnonymous).toBe(true);
  });
});

describe('operations', () => {
  it('signs in anonymously against the auth instance', async () => {
    await firebaseAuthProvider.signInAnonymously();

    expect(mockSignInAnonymously).toHaveBeenCalledWith(mockAuth);
  });

  it('creates an account with the address it was given', async () => {
    await firebaseAuthProvider.createWithEmail('martin@gmail.com', 'supersecreta');

    expect(mockCreateUser).toHaveBeenCalledWith(mockAuth, 'martin@gmail.com', 'supersecreta');
  });

  it('signs in with the address it was given', async () => {
    await firebaseAuthProvider.signInWithEmail('martin@gmail.com', 'supersecreta');

    expect(mockSignIn).toHaveBeenCalledWith(mockAuth, 'martin@gmail.com', 'supersecreta');
  });

  it('sends a password reset', async () => {
    await firebaseAuthProvider.sendPasswordReset('martin@gmail.com');

    expect(mockSendPasswordResetEmail).toHaveBeenCalledWith(mockAuth, 'martin@gmail.com');
  });

  it('signs out against the auth instance', async () => {
    await firebaseAuthProvider.signOut();

    expect(mockSignOut).toHaveBeenCalledWith(mockAuth);
  });
});

describe('linkEmail', () => {
  it('links an email credential onto the live user object', async () => {
    // Against `auth.currentUser`, NOT a user captured earlier: the anonymous
    // session can be replaced between boot and the moment someone registers,
    // and linking onto a stale object would attach the account to a uid that no
    // longer holds anything.
    const live = firebaseUser({ uid: 'anon-7', isAnonymous: true });
    mockAuth.currentUser = live;

    await firebaseAuthProvider.linkEmail('martin@gmail.com', 'supersecreta');

    expect(mockEmailCredential).toHaveBeenCalledWith('martin@gmail.com', 'supersecreta');
    expect(mockLinkWithCredential).toHaveBeenCalledWith(live, {
      __credential: 'email',
      email: 'martin@gmail.com',
      password: 'supersecreta',
    });
  });

  it('rejects with a domain error when there is no session to link onto', async () => {
    // Reaching the SDK with a null user throws a TypeError about reading a
    // property — a crash report that names nothing and a message no user can be
    // shown. The port already guards this; the adapter must not depend on it.
    mockAuth.currentUser = null;

    await expect(
      firebaseAuthProvider.linkEmail('martin@gmail.com', 'supersecreta'),
    ).rejects.toMatchObject({ code: 'unavailable' });
    expect(mockLinkWithCredential).not.toHaveBeenCalled();
  });
});

describe('changePassword', () => {
  it('proves the current password before setting the new one', async () => {
    // The order is the security property, not a detail. `updatePassword` on its
    // own would let anyone holding an unlocked phone seize the account.
    const live = firebaseUser({ email: 'martin@gmail.com' });
    mockAuth.currentUser = live;
    const order: string[] = [];
    mockReauthenticate.mockImplementation(async () => {
      order.push('reauth');
      return { user: live };
    });
    mockUpdatePassword.mockImplementation(async () => {
      order.push('update');
    });

    await firebaseAuthProvider.changePassword('laVieja123', 'laNueva456');

    expect(order).toEqual(['reauth', 'update']);
    expect(mockEmailCredential).toHaveBeenCalledWith('martin@gmail.com', 'laVieja123');
    expect(mockReauthenticate).toHaveBeenCalledWith(live, expect.anything());
    expect(mockUpdatePassword).toHaveBeenCalledWith(live, 'laNueva456');
  });

  it('does not set the new password when the current one is refused', async () => {
    const live = firebaseUser({ email: 'martin@gmail.com' });
    mockAuth.currentUser = live;
    mockReauthenticate.mockRejectedValue({ code: 'auth/invalid-credential' });

    await expect(
      firebaseAuthProvider.changePassword('equivocada1', 'laNueva456'),
    ).rejects.toMatchObject({ code: 'auth/invalid-credential' });
    expect(mockUpdatePassword).not.toHaveBeenCalled();
  });

  it('works against the live user, not one captured earlier', async () => {
    // Same reasoning as linkEmail: the session can be replaced between mounting
    // the screen and submitting the form, and changing the password of a stale
    // user object is at best a no-op and at worst the wrong account.
    const live = firebaseUser({ uid: 'user-live', email: 'martin@gmail.com' });
    mockAuth.currentUser = live;

    await firebaseAuthProvider.changePassword('laVieja123', 'laNueva456');

    expect(mockUpdatePassword).toHaveBeenCalledWith(live, 'laNueva456');
  });

  it('rejects with a domain error when nobody is signed in', async () => {
    mockAuth.currentUser = null;

    await expect(
      firebaseAuthProvider.changePassword('laVieja123', 'laNueva456'),
    ).rejects.toMatchObject({ code: 'unavailable' });
    expect(mockReauthenticate).not.toHaveBeenCalled();
  });

  it('rejects when the account has no address to re-authenticate with', async () => {
    // An anonymous session, or a future provider with no email. Building the
    // credential from a null address throws a TypeError deep in the SDK about a
    // field the user has never heard of.
    mockAuth.currentUser = firebaseUser({ email: null });

    await expect(
      firebaseAuthProvider.changePassword('laVieja123', 'laNueva456'),
    ).rejects.toMatchObject({ code: 'unavailable' });
    expect(mockReauthenticate).not.toHaveBeenCalled();
  });
});

describe('onUserChanged', () => {
  it('maps the reported user before handing it on', async () => {
    const seen: unknown[] = [];
    firebaseAuthProvider.onUserChanged((user) => seen.push(user));

    const [, listener] = mockOnAuthStateChanged.mock.calls[0];
    listener(firebaseUser({ uid: 'uid-9' }));

    expect(seen).toEqual([
      {
        uid: 'uid-9',
        email: 'martin@gmail.com',
        displayName: 'Martin',
        isAnonymous: false,
        emailVerified: true,
      },
    ]);
  });

  it('passes a signed-out state through as null', () => {
    const seen: unknown[] = [];
    firebaseAuthProvider.onUserChanged((user) => seen.push(user));

    const [, listener] = mockOnAuthStateChanged.mock.calls[0];
    listener(null);

    expect(seen).toEqual([null]);
  });

  it('subscribes against the auth instance and returns its unsubscribe', () => {
    const unsubscribe = jest.fn();
    mockOnAuthStateChanged.mockReturnValue(unsubscribe);

    const returned = firebaseAuthProvider.onUserChanged(() => {});
    returned();

    expect(mockOnAuthStateChanged).toHaveBeenCalledWith(mockAuth, expect.any(Function));
    expect(unsubscribe).toHaveBeenCalled();
  });
});

describe('failures', () => {
  it('lets an SDK rejection through untouched', async () => {
    // The opposite of the observability adapter, and deliberately so. There the
    // hard invariant is that reporting can never break the app, so failures die
    // at the boundary. Here the failure IS the answer: the port translates it
    // into a code and the user is told what happened.
    const sdkError = { code: 'auth/email-already-in-use', message: 'taken' };
    mockCreateUser.mockRejectedValue(sdkError);

    await expect(
      firebaseAuthProvider.createWithEmail('martin@gmail.com', 'supersecreta'),
    ).rejects.toBe(sdkError);
  });
});
