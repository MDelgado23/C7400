import { render, fireEvent } from '@testing-library/react-native';
import { AuthSheetView } from '../AuthSheetView';
import type { AuthMode } from '../authSheetState';

function handlers() {
  return {
    onChangeEmail: jest.fn(),
    onChangePassword: jest.fn(),
    onToggleReveal: jest.fn(),
    onSubmit: jest.fn(),
    onSelectMode: jest.fn(),
    onDismiss: jest.fn(),
  };
}

// RNTL v14 note: render() is async — it returns a Promise of the query bag.
async function renderView(
  props: Partial<React.ComponentProps<typeof AuthSheetView>> = {},
) {
  const spies = handlers();
  const view = await render(
    <AuthSheetView
      mode="intro"
      email=""
      password=""
      busy={false}
      bottomInset={0}
      revealed={false}
      {...spies}
      {...props}
    />,
  );
  return { ...spies, view };
}

describe('intro', () => {
  it('leads with what the user gets, not with a form', async () => {
    const { view } = await renderView({ mode: 'intro' });

    expect(view.queryByLabelText('Mail')).toBeNull();
    expect(view.getByLabelText('Crear cuenta')).toBeTruthy();
    expect(view.getByLabelText('Ya tengo una cuenta')).toBeTruthy();
  });

  it('always offers a way out', async () => {
    // Anonymous-first is a promise: the user can decline and keep using the
    // radio exactly as before. A sheet with no exit breaks that promise.
    const { onDismiss, view } = await renderView({ mode: 'intro' });

    await fireEvent.press(view.getByLabelText('Ahora no'));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('moves to the register form', async () => {
    const { onSelectMode, view } = await renderView({ mode: 'intro' });

    await fireEvent.press(view.getByLabelText('Crear cuenta'));

    expect(onSelectMode).toHaveBeenCalledWith('register');
  });

  it('moves to the sign-in form', async () => {
    const { onSelectMode, view } = await renderView({ mode: 'intro' });

    await fireEvent.press(view.getByLabelText('Ya tengo una cuenta'));

    expect(onSelectMode).toHaveBeenCalledWith('signIn');
  });
});

describe('forms', () => {
  it.each(['register', 'signIn'] as AuthMode[])('asks for both fields on %s', async (mode) => {
    const { view } = await renderView({ mode });

    expect(view.getByLabelText('Mail')).toBeTruthy();
    expect(view.getByLabelText('Contraseña')).toBeTruthy();
  });

  it('asks only for the address when resetting', async () => {
    const { view } = await renderView({ mode: 'reset' });

    expect(view.getByLabelText('Mail')).toBeTruthy();
    expect(view.queryByLabelText('Contraseña')).toBeNull();
  });

  it('reports what the user types', async () => {
    const { onChangeEmail, onChangePassword, view } = await renderView({ mode: 'register' });

    await fireEvent.changeText(view.getByLabelText('Mail'), 'martin@gmail.com');
    await fireEvent.changeText(view.getByLabelText('Contraseña'), 'supersecreta');

    expect(onChangeEmail).toHaveBeenCalledWith('martin@gmail.com');
    expect(onChangePassword).toHaveBeenCalledWith('supersecreta');
  });

  it('never masks the address and masks the password by default', async () => {
    const { view } = await renderView({ mode: 'register' });

    expect(view.getByLabelText('Contraseña').props.secureTextEntry).toBe(true);
    expect(view.getByLabelText('Mail').props.secureTextEntry).toBeFalsy();
  });

  it('offers to show the password', async () => {
    // Same reason as the change-password form: a typo in a masked box is
    // invisible until it has already failed. Signing in is where that costs the
    // most, because the message the user gets back says nothing about which
    // half was wrong — by design.
    const { onToggleReveal, view } = await renderView({ mode: 'signIn' });

    await fireEvent.press(view.getByLabelText('Mostrar contraseña'));

    expect(onToggleReveal).toHaveBeenCalledTimes(1);
  });

  it('unmasks the password when told to', async () => {
    const { view } = await renderView({ mode: 'signIn', revealed: true });

    expect(view.getByLabelText('Contraseña').props.secureTextEntry).toBe(false);
    expect(view.getByLabelText('Ocultar contraseña')).toBeTruthy();
  });

  it('has nothing to reveal on a form with no password', async () => {
    const { view } = await renderView({ mode: 'reset' });

    expect(view.queryByLabelText('Mostrar contraseña')).toBeNull();
  });

  it('keeps the keyboard from mangling the address', async () => {
    // Auto-capitalization and autocorrect on an email field produce an address
    // the user is sure they typed right. The port normalizes what arrives, but
    // the field should not be fighting them in the first place.
    const { view } = await renderView({ mode: 'register' });
    const email = view.getByLabelText('Mail');

    expect(email.props.autoCapitalize).toBe('none');
    expect(email.props.autoCorrect).toBe(false);
    expect(email.props.keyboardType).toBe('email-address');
  });

  it('submits when the action is pressed', async () => {
    const { onSubmit, view } = await renderView({
      mode: 'register',
      email: 'martin@gmail.com',
      password: 'supersecreta',
    });

    await fireEvent.press(view.getByLabelText('Crear mi cuenta'));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('offers the reset path from sign-in only', async () => {
    const signIn = await renderView({ mode: 'signIn' });
    expect(signIn.view.getByLabelText('Olvidé mi contraseña')).toBeTruthy();

    const register = await renderView({ mode: 'register' });
    expect(register.view.queryByLabelText('Olvidé mi contraseña')).toBeNull();
  });

  it('goes to the reset form from sign-in', async () => {
    const { onSelectMode, view } = await renderView({ mode: 'signIn' });

    await fireEvent.press(view.getByLabelText('Olvidé mi contraseña'));

    expect(onSelectMode).toHaveBeenCalledWith('reset');
  });
});

describe('busy', () => {
  it('shows work is happening', async () => {
    const { view } = await renderView({ mode: 'register', busy: true });

    expect(view.getByLabelText('Enviando')).toBeTruthy();
  });

  it('refuses a second submit while the first is in flight', async () => {
    // A double tap on "Crear mi cuenta" is two account creations racing. The
    // second fails with email-already-in-use and the user is told their own
    // brand-new account is taken.
    const { onSubmit, view } = await renderView({ mode: 'register', busy: true });

    await fireEvent.press(view.getByLabelText('Enviando'));

    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('feedback', () => {
  it('shows an error where a screen reader will announce it', async () => {
    const { view } = await renderView({
      mode: 'signIn',
      errorMessage: 'El mail o la contraseña no coinciden. Probá de nuevo.',
    });

    const alert = view.getByRole('alert');
    expect(alert).toHaveTextContent('El mail o la contraseña no coinciden. Probá de nuevo.');
  });

  it('shows a notice the same way', async () => {
    // The reset confirmation is the one that matters: it is the only signal the
    // user gets that anything happened at all.
    const { view } = await renderView({
      mode: 'reset',
      noticeMessage: 'Si el mail está registrado, ya te mandamos el enlace.',
    });

    expect(view.getByRole('alert')).toHaveTextContent(
      'Si el mail está registrado, ya te mandamos el enlace.',
    );
  });

  it('shows nothing when there is nothing to say', async () => {
    const { view } = await renderView({ mode: 'signIn' });

    expect(view.queryByRole('alert')).toBeNull();
  });
});
