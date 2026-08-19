import {
  setAuthProvider,
  __resetAuth,
  getCurrentUser,
  subscribeToUser,
  startAnonymousSession,
  registerWithEmail,
  signInWithEmail,
  upgradeToEmailAccount,
  sendPasswordReset,
  changePassword,
  signOut,
  type AuthProvider,
  type AppUser,
} from '../authService';
import { AuthError } from '../authErrors';

function anonUser(uid = 'anon-1'): AppUser {
  return { uid, email: null, displayName: null, isAnonymous: true, emailVerified: false };
}

function emailUser(uid = 'user-1', email = 'martin@gmail.com'): AppUser {
  return { uid, email, displayName: null, isAnonymous: false, emailVerified: false };
}

type FakeProvider = AuthProvider & {
  signInAnonymously: jest.Mock;
  createWithEmail: jest.Mock;
  signInWithEmail: jest.Mock;
  linkEmail: jest.Mock;
  sendPasswordReset: jest.Mock;
  changePassword: jest.Mock;
  signOut: jest.Mock;
  /** Drives the provider's user-changed callback from the test. */
  emit: (user: AppUser | null) => void;
};

/**
 * @param restored what the provider reports on subscribe — the session it found
 *   on the device. Real providers ALWAYS report once here, `null` included.
 * @param delayMs report asynchronously, reproducing the cold-boot window in
 *   which a session exists but has not been announced yet.
 */
function fakeProvider(
  { restored = null, delayMs = 0 }: { restored?: AppUser | null; delayMs?: number } = {},
): FakeProvider {
  let listener: ((user: AppUser | null) => void) | null = null;
  return {
    signInAnonymously: jest.fn(async () => anonUser()),
    createWithEmail: jest.fn(async () => emailUser()),
    signInWithEmail: jest.fn(async () => emailUser()),
    linkEmail: jest.fn(async () => emailUser()),
    sendPasswordReset: jest.fn(async () => {}),
    changePassword: jest.fn(async () => {}),
    signOut: jest.fn(async () => {}),
    onUserChanged(next: (user: AppUser | null) => void) {
      listener = next;
      // Every real provider announces the restored session exactly once on
      // subscribe. The port depends on that report arriving, so a fake that
      // stayed silent would be testing a provider that does not exist.
      if (delayMs > 0) setTimeout(() => listener?.(restored), delayMs);
      else next(restored);
      return () => {
        listener = null;
      };
    },
    emit(user: AppUser | null) {
      listener?.(user);
    },
  };
}

beforeEach(() => {
  __resetAuth();
});

describe('with no provider registered', () => {
  it('reports no signed-in user instead of throwing', () => {
    expect(getCurrentUser()).toBeNull();
  });

  it('rejects a user-initiated action rather than failing silently', async () => {
    // The opposite invariant to `observability`, and deliberately so. Analytics
    // may disappear without anyone noticing; a sign-in that reports success
    // while nothing happened leaves the user tapping a dead button forever.
    await expect(signInWithEmail('martin@gmail.com', 'supersecreta')).rejects.toMatchObject({
      code: 'unavailable',
    });
  });

  it('does not reject the boot session, which no one asked for', async () => {
    // Nobody tapped anything, so there is no one to show an error to — and the
    // radio must play with or without an identity behind it.
    await expect(startAnonymousSession()).resolves.toBeNull();
  });
});

describe('startAnonymousSession', () => {
  it('signs in and exposes the user', async () => {
    const provider = fakeProvider();
    setAuthProvider(provider);

    const user = await startAnonymousSession();

    expect(provider.signInAnonymously).toHaveBeenCalled();
    expect(user?.isAnonymous).toBe(true);
  });

  it('does not sign in again when someone is already signed in', async () => {
    // Every call to signInAnonymously mints a NEW uid. Calling it over an
    // existing session orphans the previous account and everything attached to
    // it — the saved articles the account existed to keep.
    const provider = fakeProvider();
    setAuthProvider(provider);
    provider.emit(emailUser());

    await startAnonymousSession();

    expect(provider.signInAnonymously).not.toHaveBeenCalled();
  });

  it('waits for the restored session before minting a new account', async () => {
    // THE cold-boot hazard. The provider restores the previous session
    // asynchronously, so for a moment after boot there is a real account on the
    // device and `currentUser` still reads null. Deciding inside that window
    // mints a brand-new uid and orphans everything the old one held — which is
    // the entire value the account existed to provide.
    const provider = fakeProvider({ restored: emailUser('user-restored'), delayMs: 10 });
    setAuthProvider(provider);

    const user = await startAnonymousSession();

    expect(provider.signInAnonymously).not.toHaveBeenCalled();
    expect(user?.uid).toBe('user-restored');
  });

  it('signs in once the provider confirms there is no session to restore', async () => {
    const provider = fakeProvider({ restored: null, delayMs: 10 });
    setAuthProvider(provider);

    const user = await startAnonymousSession();

    expect(provider.signInAnonymously).toHaveBeenCalledTimes(1);
    expect(user?.isAnonymous).toBe(true);
  });

  it('gives up waiting rather than leaving the app without an identity', async () => {
    // A provider that never reports is broken, and signInAnonymously will very
    // likely fail too — but blocking forever guarantees no identity, while
    // trying guarantees nothing worse than the failure we already handle.
    const provider = fakeProvider();
    provider.onUserChanged = () => () => {};
    setAuthProvider(provider);

    await expect(startAnonymousSession()).resolves.not.toThrow();
    expect(provider.signInAnonymously).toHaveBeenCalled();
  }, 15000);

  it('resolves to null instead of throwing when the provider fails', async () => {
    const provider = fakeProvider();
    provider.signInAnonymously.mockRejectedValue({ code: 'auth/network-request-failed' });
    setAuthProvider(provider);

    await expect(startAnonymousSession()).resolves.toBeNull();
  });
});

describe('registerWithEmail', () => {
  it('normalizes the address before it reaches the provider', async () => {
    const provider = fakeProvider();
    setAuthProvider(provider);

    await registerWithEmail('  Martin@Gmail.com ', 'supersecreta');

    expect(provider.createWithEmail).toHaveBeenCalledWith('martin@gmail.com', 'supersecreta');
  });

  it('rejects a malformed address without calling the provider', async () => {
    // A typo does not deserve a network round-trip, and the user does not
    // deserve a spinner before being told what they can see themselves.
    const provider = fakeProvider();
    setAuthProvider(provider);

    await expect(registerWithEmail('martin', 'supersecreta')).rejects.toMatchObject({
      code: 'invalid-email',
    });
    expect(provider.createWithEmail).not.toHaveBeenCalled();
  });

  it('rejects a short password without calling the provider', async () => {
    const provider = fakeProvider();
    setAuthProvider(provider);

    await expect(registerWithEmail('martin@gmail.com', 'abc')).rejects.toMatchObject({
      code: 'weak-password',
    });
    expect(provider.createWithEmail).not.toHaveBeenCalled();
  });

  it('translates a provider failure into a domain error', async () => {
    const provider = fakeProvider();
    provider.createWithEmail.mockRejectedValue({ code: 'auth/email-already-in-use' });
    setAuthProvider(provider);

    const error = await registerWithEmail('martin@gmail.com', 'supersecreta').catch((e) => e);

    expect(error).toBeInstanceOf(AuthError);
    expect(error.code).toBe('email-already-in-use');
  });
});

describe('signInWithEmail', () => {
  it('normalizes the address before it reaches the provider', async () => {
    const provider = fakeProvider();
    setAuthProvider(provider);

    await signInWithEmail(' Martin@Gmail.com', 'supersecreta');

    expect(provider.signInWithEmail).toHaveBeenCalledWith('martin@gmail.com', 'supersecreta');
  });

  it('rejects a malformed address without calling the provider', async () => {
    const provider = fakeProvider();
    setAuthProvider(provider);

    await expect(signInWithEmail('martin', 'supersecreta')).rejects.toMatchObject({
      code: 'invalid-email',
    });
    expect(provider.signInWithEmail).not.toHaveBeenCalled();
  });

  it('does not apply the password policy when signing in', async () => {
    // The policy guards what we CREATE. Applying it at sign-in locks out every
    // account made before the rule existed, with a message blaming the user for
    // a password we ourselves accepted.
    const provider = fakeProvider();
    setAuthProvider(provider);

    await signInWithEmail('martin@gmail.com', 'abc');

    expect(provider.signInWithEmail).toHaveBeenCalledWith('martin@gmail.com', 'abc');
  });
});

describe('upgradeToEmailAccount', () => {
  it('links the credential onto the anonymous session, keeping the uid', async () => {
    // The whole point of anonymous-first: whatever the user saved before
    // registering stays theirs. A fresh sign-up would hand them a new uid and
    // silently drop it all.
    const provider = fakeProvider();
    provider.linkEmail.mockResolvedValue(emailUser('anon-1'));
    setAuthProvider(provider);
    provider.emit(anonUser('anon-1'));

    const user = await upgradeToEmailAccount('  Martin@Gmail.com ', 'supersecreta');

    expect(provider.linkEmail).toHaveBeenCalledWith('martin@gmail.com', 'supersecreta');
    expect(user.uid).toBe('anon-1');
    expect(user.isAnonymous).toBe(false);
  });

  it('applies the password policy, because this is where the account is created', async () => {
    const provider = fakeProvider();
    setAuthProvider(provider);
    provider.emit(anonUser());

    await expect(upgradeToEmailAccount('martin@gmail.com', 'abc')).rejects.toMatchObject({
      code: 'weak-password',
    });
    expect(provider.linkEmail).not.toHaveBeenCalled();
  });

  it('refuses to link onto an account that is already registered', async () => {
    // linkWithCredential on a non-anonymous user is a different operation with
    // different consequences. Calling it here would be a bug in the UI, and it
    // should surface as one instead of as a provider error.
    const provider = fakeProvider();
    setAuthProvider(provider);
    provider.emit(emailUser());

    await expect(
      upgradeToEmailAccount('otro@gmail.com', 'supersecreta'),
    ).rejects.toMatchObject({ code: 'unavailable' });
    expect(provider.linkEmail).not.toHaveBeenCalled();
  });

  it('surfaces an address that already belongs to another account', async () => {
    // Distinct from email-already-in-use: the UI must offer to sign in to that
    // account AND warn that what was saved anonymously will not come along.
    const provider = fakeProvider();
    provider.linkEmail.mockRejectedValue({ code: 'auth/credential-already-in-use' });
    setAuthProvider(provider);
    provider.emit(anonUser());

    await expect(
      upgradeToEmailAccount('martin@gmail.com', 'supersecreta'),
    ).rejects.toMatchObject({ code: 'credential-already-in-use' });
  });
});

describe('sendPasswordReset', () => {
  it('normalizes the address before it reaches the provider', async () => {
    const provider = fakeProvider();
    setAuthProvider(provider);

    await sendPasswordReset(' Martin@Gmail.com ');

    expect(provider.sendPasswordReset).toHaveBeenCalledWith('martin@gmail.com');
  });

  it('resolves even when the address is not registered', async () => {
    // Same enumeration oracle as the sign-in error: a reset that fails only for
    // unknown addresses tells an attacker exactly which ones exist. The user is
    // told "if the address is registered, the mail is on its way" either way.
    const provider = fakeProvider();
    provider.sendPasswordReset.mockRejectedValue({ code: 'auth/user-not-found' });
    setAuthProvider(provider);

    await expect(sendPasswordReset('martin@gmail.com')).resolves.toBeUndefined();
  });

  it('still surfaces a failure the user can act on', async () => {
    // A dead network is not an enumeration leak, and hiding it would leave the
    // user waiting for a mail that was never sent.
    const provider = fakeProvider();
    provider.sendPasswordReset.mockRejectedValue({ code: 'auth/network-request-failed' });
    setAuthProvider(provider);

    await expect(sendPasswordReset('martin@gmail.com')).rejects.toMatchObject({
      code: 'network',
    });
  });
});

describe('changePassword', () => {
  function signedIn() {
    const provider = fakeProvider();
    setAuthProvider(provider);
    provider.emit(emailUser());
    return provider;
  }

  it('sends both passwords through to the provider', async () => {
    const provider = signedIn();

    await changePassword('laVieja123', 'laNueva456');

    expect(provider.changePassword).toHaveBeenCalledWith('laVieja123', 'laNueva456');
  });

  it('applies the policy to the NEW password only', async () => {
    // The current one was accepted whenever the account was made, possibly
    // under an older rule. Rejecting it now would lock the user out of the very
    // screen that exists to fix their password.
    const provider = signedIn();

    await expect(changePassword('abc', 'unaContraseñaLarga')).resolves.toBeUndefined();
    await expect(changePassword('laVieja123', 'corta')).rejects.toMatchObject({
      code: 'weak-password',
    });
  });

  it('rejects a weak new password without calling the provider', async () => {
    const provider = signedIn();

    await expect(changePassword('laVieja123', 'corta')).rejects.toMatchObject({
      code: 'weak-password',
    });
    expect(provider.changePassword).not.toHaveBeenCalled();
  });

  it('refuses when the new password is the current one', async () => {
    // Firebase accepts it happily and nothing changes. The user walks away
    // believing they rotated a password they did not.
    const provider = signedIn();

    await expect(changePassword('laMisma123', 'laMisma123')).rejects.toMatchObject({
      code: 'same-password',
    });
    expect(provider.changePassword).not.toHaveBeenCalled();
  });

  it('names the wrong CURRENT password for what it is', async () => {
    // Deliberately NOT collapsed into `wrong-credentials`. That collapse exists
    // to stop an attacker probing which addresses are registered — at sign-in,
    // where they do not know yet. Here the person is already signed in and the
    // account is known, so hiding which field was wrong protects nothing and
    // leaves them guessing.
    const provider = signedIn();
    provider.changePassword.mockRejectedValue({ code: 'auth/invalid-credential' });

    await expect(changePassword('equivocada1', 'laNueva456')).rejects.toMatchObject({
      code: 'wrong-current-password',
    });
  });

  it('passes any other provider failure through as itself', async () => {
    const provider = signedIn();
    provider.changePassword.mockRejectedValue({ code: 'auth/network-request-failed' });

    await expect(changePassword('laVieja123', 'laNueva456')).rejects.toMatchObject({
      code: 'network',
    });
  });

  it('refuses with nobody signed in', async () => {
    setAuthProvider(fakeProvider());

    await expect(changePassword('laVieja123', 'laNueva456')).rejects.toMatchObject({
      code: 'unavailable',
    });
  });

  it('refuses on an anonymous session, which has no password to change', async () => {
    const provider = fakeProvider();
    setAuthProvider(provider);
    provider.emit(anonUser());

    await expect(changePassword('laVieja123', 'laNueva456')).rejects.toMatchObject({
      code: 'unavailable',
    });
    expect(provider.changePassword).not.toHaveBeenCalled();
  });
});

describe('user state', () => {
  it('exposes the user the provider reports', () => {
    const provider = fakeProvider();
    setAuthProvider(provider);

    provider.emit(emailUser('user-9'));

    expect(getCurrentUser()?.uid).toBe('user-9');
  });

  it('notifies subscribers of a change', () => {
    const provider = fakeProvider();
    setAuthProvider(provider);
    const seen: (AppUser | null)[] = [];
    subscribeToUser((user) => seen.push(user));

    provider.emit(anonUser());
    provider.emit(emailUser());

    expect(seen.map((u) => u?.isAnonymous)).toEqual([true, false]);
  });

  it('delivers the current user to a late subscriber immediately', () => {
    // A screen mounted after sign-in would otherwise render as signed-out until
    // something unrelated happened to change the session.
    const provider = fakeProvider();
    setAuthProvider(provider);
    provider.emit(emailUser('user-9'));

    const seen: (AppUser | null)[] = [];
    subscribeToUser((user) => seen.push(user));

    expect(seen).toHaveLength(1);
    expect(seen[0]?.uid).toBe('user-9');
  });

  it('stops notifying after unsubscribe', () => {
    const provider = fakeProvider();
    setAuthProvider(provider);
    const listener = jest.fn();
    const unsubscribe = subscribeToUser(listener);
    listener.mockClear();

    unsubscribe();
    provider.emit(emailUser());

    expect(listener).not.toHaveBeenCalled();
  });

  it('never lets one throwing subscriber starve the others', () => {
    const provider = fakeProvider();
    setAuthProvider(provider);
    const healthy = jest.fn();
    subscribeToUser(() => {
      throw new Error('screen exploded');
    });
    subscribeToUser(healthy);
    healthy.mockClear();

    expect(() => provider.emit(emailUser())).not.toThrow();
    expect(healthy).toHaveBeenCalled();
  });
});

describe('signOut', () => {
  it('delegates to the provider', async () => {
    const provider = fakeProvider();
    setAuthProvider(provider);
    provider.emit(emailUser());

    await signOut();

    expect(provider.signOut).toHaveBeenCalled();
  });

  it('translates a provider failure into a domain error', async () => {
    const provider = fakeProvider();
    provider.signOut.mockRejectedValue({ code: 'auth/network-request-failed' });
    setAuthProvider(provider);

    await expect(signOut()).rejects.toMatchObject({ code: 'network' });
  });
});
