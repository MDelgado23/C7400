import {
  getAuth,
  signInAnonymously as firebaseSignInAnonymously,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  linkWithCredential,
  sendPasswordResetEmail,
  reauthenticateWithCredential,
  updatePassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  EmailAuthProvider,
  type User as FirebaseUser,
} from '@react-native-firebase/auth';
import { AuthError } from './authErrors';
import type { AppUser, AuthProvider } from './authService';

/**
 * Firebase adapter for the auth port.
 *
 * The ONLY module in the app that imports the auth SDK. Everything else calls
 * the port, so swapping providers means replacing this file and the one line
 * that registers it.
 *
 * Two things it does NOT do, both deliberate:
 *
 * 1. It does not validate. The port has already normalized the address and
 *    applied the password policy by the time anything reaches here.
 * 2. It does not swallow failures. That is the inverse of `firebaseSink`, whose
 *    invariant is that reporting can never break the app. Here the failure IS
 *    the answer — the port translates the provider's code into one of ours and
 *    the UI tells the user what happened.
 */

/**
 * Firebase's user → ours.
 *
 * This function is the port. Firebase's `User` carries `refreshToken`,
 * `providerData`, `multiFactor` and a `delete()` method; a screen that can reach
 * any of those is a screen coupled to Firebase, and this is the only place that
 * coupling can be stopped. Fields are copied explicitly rather than spread for
 * exactly that reason.
 *
 * The `?? null` guards are not decoration: native hands back `undefined` where
 * the web SDK types promise `null`, so a `displayName === null` check in the UI
 * would quietly miss.
 */
function toAppUser(user: FirebaseUser): AppUser {
  return {
    uid: user.uid,
    email: user.email ?? null,
    displayName: user.displayName ?? null,
    // Defaults to anonymous when absent. Failing the other way would let the UI
    // offer "creá tu cuenta" to someone who already has one — or hide it from
    // someone whose data lives only on this device.
    isAnonymous: user.isAnonymous ?? true,
    emailVerified: user.emailVerified ?? false,
  };
}

export const firebaseAuthProvider: AuthProvider = {
  async signInAnonymously(): Promise<AppUser> {
    const credential = await firebaseSignInAnonymously(getAuth());
    return toAppUser(credential.user);
  },

  async createWithEmail(email: string, password: string): Promise<AppUser> {
    const credential = await createUserWithEmailAndPassword(getAuth(), email, password);
    return toAppUser(credential.user);
  },

  async signInWithEmail(email: string, password: string): Promise<AppUser> {
    const credential = await signInWithEmailAndPassword(getAuth(), email, password);
    return toAppUser(credential.user);
  },

  async linkEmail(email: string, password: string): Promise<AppUser> {
    // Read live off the auth instance rather than from anything captured
    // earlier: the anonymous session can be replaced between boot and the moment
    // someone registers, and linking onto a stale object would attach the new
    // account to a uid that no longer holds the articles it was meant to keep.
    const user = getAuth().currentUser;
    if (user === null) {
      // Handing a null user to the SDK throws a TypeError about reading a
      // property of null: a crash report that names nothing and a message no
      // user can be shown. The port guards this too; the adapter does not
      // depend on it having done so.
      throw new AuthError('unavailable', 'no signed-in user to link a credential onto');
    }
    const credential = await linkWithCredential(
      user,
      EmailAuthProvider.credential(email, password),
    );
    return toAppUser(credential.user);
  },

  async sendPasswordReset(email: string): Promise<void> {
    await sendPasswordResetEmail(getAuth(), email);
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    // Live off the auth instance, like `linkEmail` and for the same reason: the
    // session can be replaced between the screen mounting and the form being
    // submitted, and changing the password on a stale user object is at best a
    // no-op and at worst the wrong account.
    const user = getAuth().currentUser;
    if (user === null) {
      throw new AuthError('unavailable', 'no signed-in user to change a password for');
    }
    if (user.email === null) {
      // An anonymous session, or a future provider with no address. Building the
      // credential from null throws a TypeError deep inside the SDK, naming a
      // field no user has ever heard of.
      throw new AuthError('unavailable', 'account has no email credential to re-authenticate');
    }

    // The order IS the security property. `updatePassword` on its own succeeds
    // for any recently-signed-in user, which is precisely how somebody holding
    // an unlocked phone takes the account. Proving the old password first is
    // what makes this a change rather than a seizure.
    await reauthenticateWithCredential(
      user,
      EmailAuthProvider.credential(user.email, currentPassword),
    );
    await updatePassword(user, newPassword);
  },

  async signOut(): Promise<void> {
    await firebaseSignOut(getAuth());
  },

  onUserChanged(listener: (user: AppUser | null) => void): () => void {
    // Fires once on subscribe with the restored session, which is what makes the
    // anonymous account survive a restart without us persisting anything.
    return onAuthStateChanged(getAuth(), (user) => {
      listener(user ? toAppUser(user) : null);
    });
  },
};
