import { render, fireEvent, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { AppUser } from '../../../core/auth/authService';

const mockRegisterWithEmail = jest.fn();
const mockSignInWithEmail = jest.fn();
const mockUpgradeToEmailAccount = jest.fn();
const mockSendPasswordReset = jest.fn();
let mockUser: AppUser | null = null;

jest.mock('../../../core/auth/authService', () => ({
  registerWithEmail: (...args: unknown[]) => mockRegisterWithEmail(...args),
  signInWithEmail: (...args: unknown[]) => mockSignInWithEmail(...args),
  upgradeToEmailAccount: (...args: unknown[]) => mockUpgradeToEmailAccount(...args),
  sendPasswordReset: (...args: unknown[]) => mockSendPasswordReset(...args),
  getCurrentUser: () => mockUser,
  subscribeToUser: () => () => {},
}));

import { AuthSheet } from '../AuthSheet';
import { AuthError } from '../../../core/auth/authErrors';

function anonUser(): AppUser {
  return {
    uid: 'anon-1',
    email: null,
    displayName: null,
    isAnonymous: true,
    emailVerified: false,
  };
}

function registeredUser(): AppUser {
  return {
    uid: 'user-1',
    email: 'viejo@gmail.com',
    displayName: null,
    isAnonymous: false,
    emailVerified: true,
  };
}

/**
 * Fixed metrics standing in for an Android phone with the three-button
 * navigation bar — the 48pt bottom inset is the thing the sheet has to clear.
 */
const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 24, left: 0, right: 0, bottom: 48 },
};

async function openSheet(initialMode?: 'intro' | 'register' | 'signIn' | 'reset') {
  const onClose = jest.fn();
  const view = await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <AuthSheet visible onClose={onClose} initialMode={initialMode} />
    </SafeAreaProvider>,
  );
  const reopen = async (visible: boolean) => {
    await view.rerender(
      <SafeAreaProvider initialMetrics={METRICS}>
        <AuthSheet visible={visible} onClose={onClose} initialMode={initialMode} />
      </SafeAreaProvider>,
    );
  };
  return { onClose, reopen };
}

/** Walks the sheet from its pitch to a filled-in form. */
async function fillForm(entry: 'Crear cuenta' | 'Ya tengo una cuenta', password?: string) {
  await fireEvent.press(screen.getByLabelText(entry));
  await fireEvent.changeText(screen.getByLabelText('Mail'), 'martin@gmail.com');
  if (password !== undefined) {
    await fireEvent.changeText(screen.getByLabelText('Contraseña'), password);
  }
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = anonUser();
  mockRegisterWithEmail.mockResolvedValue(registeredUser());
  mockSignInWithEmail.mockResolvedValue(registeredUser());
  mockUpgradeToEmailAccount.mockResolvedValue(registeredUser());
  mockSendPasswordReset.mockResolvedValue(undefined);
});

describe('registering', () => {
  it('UPGRADES the anonymous session instead of creating a second account', async () => {
    // The single most destructive thing this screen could get wrong. Calling
    // register on an anonymous session hands the user a new uid and abandons
    // everything the old one held — the saved articles they registered to keep.
    await openSheet();
    await fillForm('Crear cuenta', 'supersecreta');

    await fireEvent.press(screen.getByLabelText('Crear mi cuenta'));

    expect(mockUpgradeToEmailAccount).toHaveBeenCalledWith('martin@gmail.com', 'supersecreta');
    expect(mockRegisterWithEmail).not.toHaveBeenCalled();
  });

  it('creates a fresh account when there is no anonymous session to keep', async () => {
    mockUser = null;
    await openSheet();
    await fillForm('Crear cuenta', 'supersecreta');

    await fireEvent.press(screen.getByLabelText('Crear mi cuenta'));

    expect(mockRegisterWithEmail).toHaveBeenCalledWith('martin@gmail.com', 'supersecreta');
    expect(mockUpgradeToEmailAccount).not.toHaveBeenCalled();
  });

  it('closes once the account exists', async () => {
    const { onClose } = await openSheet();
    await fillForm('Crear cuenta', 'supersecreta');

    await fireEvent.press(screen.getByLabelText('Crear mi cuenta'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('signing in', () => {
  it('signs in with what was typed', async () => {
    await openSheet();
    await fillForm('Ya tengo una cuenta', 'supersecreta');

    await fireEvent.press(screen.getByLabelText('Entrar'));

    expect(mockSignInWithEmail).toHaveBeenCalledWith('martin@gmail.com', 'supersecreta');
  });
});

describe('failures', () => {
  it('shows the message for the code, not the provider text', async () => {
    // The user reads OUR sentence. The provider's is for Crashlytics.
    mockUpgradeToEmailAccount.mockRejectedValue(new AuthError('credential-already-in-use'));
    const { onClose } = await openSheet();
    await fillForm('Crear cuenta', 'supersecreta');

    await fireEvent.press(screen.getByLabelText('Crear mi cuenta'));

    expect(screen.getByRole('alert')).toHaveTextContent(/Ese mail ya tiene una cuenta/);
    // Closing on failure would look exactly like success and quietly discard
    // everything the user typed.
    expect(onClose).not.toHaveBeenCalled();
  });

  it('translates a failure that never went through the port', async () => {
    // A provider error thrown outside our own validation still has to arrive as
    // a sentence and not as a blank alert.
    mockSignInWithEmail.mockRejectedValue({ code: 'auth/network-request-failed' });
    await openSheet();
    await fillForm('Ya tengo una cuenta', 'supersecreta');

    await fireEvent.press(screen.getByLabelText('Entrar'));

    expect(screen.getByRole('alert')).toHaveTextContent(/No hay conexión/);
  });

  it('clears a stale error when the user moves to another step', async () => {
    // An error about a password left standing over a form that no longer asks
    // for one reads as a fresh failure of something the user has not tried yet.
    mockSignInWithEmail.mockRejectedValue(new AuthError('wrong-credentials'));
    await openSheet();
    await fillForm('Ya tengo una cuenta', 'supersecreta');
    await fireEvent.press(screen.getByLabelText('Entrar'));
    expect(screen.queryByRole('alert')).not.toBeNull();

    await fireEvent.press(screen.getByLabelText('Olvidé mi contraseña'));

    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('password reset', () => {
  it('confirms without saying whether the address is registered', async () => {
    await openSheet();
    await fireEvent.press(screen.getByLabelText('Ya tengo una cuenta'));
    await fireEvent.press(screen.getByLabelText('Olvidé mi contraseña'));
    await fireEvent.changeText(screen.getByLabelText('Mail'), 'martin@gmail.com');

    await fireEvent.press(screen.getByLabelText('Mandame el enlace'));

    expect(mockSendPasswordReset).toHaveBeenCalledWith('martin@gmail.com');
    const notice = screen.getByRole('alert');
    expect(notice).toHaveTextContent(/Si el mail está registrado/);
  });

  it('stays open so the user can read the confirmation', async () => {
    // Closing here would leave no trace that anything happened, and the user
    // would send the mail again and again.
    const { onClose } = await openSheet();
    await fireEvent.press(screen.getByLabelText('Ya tengo una cuenta'));
    await fireEvent.press(screen.getByLabelText('Olvidé mi contraseña'));
    await fireEvent.changeText(screen.getByLabelText('Mail'), 'martin@gmail.com');

    await fireEvent.press(screen.getByLabelText('Mandame el enlace'));

    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('opening', () => {
  it('starts on the pitch by default', async () => {
    await openSheet();

    expect(screen.getByLabelText('Crear cuenta')).toBeTruthy();
    expect(screen.queryByLabelText('Mail')).toBeNull();
  });

  it('can open straight onto the sign-in form', async () => {
    // Reached from the account row, where the pitch has already been made by
    // the row's own message — and where someone who came to LOG IN should not
    // have to pass through a registration form to get there.
    await openSheet('signIn');

    expect(screen.getByLabelText('Mail')).toBeTruthy();
    expect(screen.getByLabelText('Entrar')).toBeTruthy();
  });

  it('can open straight onto the register form', async () => {
    await openSheet('register');

    expect(screen.getByLabelText('Crear mi cuenta')).toBeTruthy();
  });

  it('FORGETS what was typed when it is closed and opened again', async () => {
    // The state lives above the Modal, so without a reset the next person to
    // open this sheet finds the previous one's password still in the field.
    const { reopen } = await openSheet('signIn');
    await fireEvent.changeText(screen.getByLabelText('Mail'), 'martin@gmail.com');
    await fireEvent.changeText(screen.getByLabelText('Contraseña'), 'supersecreta');

    await reopen(false);
    await reopen(true);

    expect(screen.getByLabelText('Mail').props.value).toBe('');
    expect(screen.getByLabelText('Contraseña').props.value).toBe('');
  });

  it('returns to its starting step when reopened', async () => {
    const { reopen } = await openSheet();
    await fireEvent.press(screen.getByLabelText('Crear cuenta'));
    expect(screen.getByLabelText('Crear mi cuenta')).toBeTruthy();

    await reopen(false);
    await reopen(true);

    expect(screen.queryByLabelText('Mail')).toBeNull();
  });

  it('drops a stale error from the previous attempt', async () => {
    // An error about a password typed minutes ago, sitting over an empty form,
    // reads as a failure of something the user has not tried yet.
    mockSignInWithEmail.mockRejectedValue(new AuthError('wrong-credentials'));
    const { reopen } = await openSheet('signIn');
    await fireEvent.changeText(screen.getByLabelText('Mail'), 'martin@gmail.com');
    await fireEvent.changeText(screen.getByLabelText('Contraseña'), 'supersecreta');
    await fireEvent.press(screen.getByLabelText('Entrar'));
    expect(screen.queryByRole('alert')).not.toBeNull();

    await reopen(false);
    await reopen(true);

    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('dismissing', () => {
  it('lets the user decline and keep listening', async () => {
    const { onClose } = await openSheet();

    await fireEvent.press(screen.getByLabelText('Ahora no'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
