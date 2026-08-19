import { render, fireEvent } from '@testing-library/react-native';
import { ChangePasswordView } from '../ChangePasswordView';

async function renderView(
  props: Partial<React.ComponentProps<typeof ChangePasswordView>> = {},
) {
  const spies = {
    onChangeCurrent: jest.fn(),
    onChangeNext: jest.fn(),
    onToggleReveal: jest.fn(),
    onSubmit: jest.fn(),
  };
  const view = await render(
    <ChangePasswordView
      currentPassword=""
      newPassword=""
      revealed={false}
      busy={false}
      {...spies}
      {...props}
    />,
  );
  return { ...spies, view };
}

describe('the form', () => {
  it('asks for the current password as well as the new one', async () => {
    // Not politeness. Without it, anyone holding an unlocked phone changes the
    // password and the owner is locked out of their own account.
    const { view } = await renderView();

    expect(view.getByLabelText('Contraseña actual')).toBeTruthy();
    expect(view.getByLabelText('Contraseña nueva')).toBeTruthy();
  });

  it('reports what is typed in each field', async () => {
    const { onChangeCurrent, onChangeNext, view } = await renderView();

    await fireEvent.changeText(view.getByLabelText('Contraseña actual'), 'laVieja123');
    await fireEvent.changeText(view.getByLabelText('Contraseña nueva'), 'laNueva456');

    expect(onChangeCurrent).toHaveBeenCalledWith('laVieja123');
    expect(onChangeNext).toHaveBeenCalledWith('laNueva456');
  });

  it('masks both fields by default', async () => {
    const { view } = await renderView();

    expect(view.getByLabelText('Contraseña actual').props.secureTextEntry).toBe(true);
    expect(view.getByLabelText('Contraseña nueva').props.secureTextEntry).toBe(true);
  });

  it('says what the password has to satisfy before it is rejected', async () => {
    // A rule the user only learns by breaking it is a rule stated too late.
    const { view } = await renderView();

    expect(view.getByText(/8/)).toBeTruthy();
  });

  it('submits', async () => {
    const { onSubmit, view } = await renderView({
      currentPassword: 'laVieja123',
      newPassword: 'laNueva456',
    });

    await fireEvent.press(view.getByLabelText('Cambiar contraseña'));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});

describe('revealing the new password', () => {
  it('offers to show it', async () => {
    // There is no confirmation field: a typo in a masked box locks the user out
    // until they go through an email reset. Letting them SEE what they typed
    // costs one control and prevents that outright.
    const { onToggleReveal, view } = await renderView();

    await fireEvent.press(view.getByLabelText('Mostrar contraseña'));

    expect(onToggleReveal).toHaveBeenCalledTimes(1);
  });

  it('unmasks only the new password, never the current one', async () => {
    // The current one is already known to whoever is typing it; showing it adds
    // nothing and puts an existing secret on screen for anybody nearby.
    const { view } = await renderView({ revealed: true });

    expect(view.getByLabelText('Contraseña nueva').props.secureTextEntry).toBe(false);
    expect(view.getByLabelText('Contraseña actual').props.secureTextEntry).toBe(true);
  });

  it('flips the control label once shown', async () => {
    const { view } = await renderView({ revealed: true });

    expect(view.getByLabelText('Ocultar contraseña')).toBeTruthy();
  });
});

describe('busy', () => {
  it('shows work is happening', async () => {
    const { view } = await renderView({ busy: true });

    expect(view.getByLabelText('Guardando')).toBeTruthy();
  });

  it('refuses a second submit while the first is in flight', async () => {
    const { onSubmit, view } = await renderView({ busy: true });

    await fireEvent.press(view.getByLabelText('Guardando'));

    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('feedback', () => {
  it('announces a failure', async () => {
    const { view } = await renderView({ errorMessage: 'La contraseña actual no coincide.' });

    expect(view.getByRole('alert')).toHaveTextContent('La contraseña actual no coincide.');
  });

  it('announces success, because nothing else on screen would', async () => {
    // The fields clear and the screen otherwise looks untouched. Without a word,
    // the user cannot tell a successful change from a silent failure.
    const { view } = await renderView({ noticeMessage: 'Listo, cambiaste la contraseña.' });

    expect(view.getByRole('alert')).toHaveTextContent('Listo, cambiaste la contraseña.');
  });

  it('says nothing when there is nothing to say', async () => {
    const { view } = await renderView();

    expect(view.queryByRole('alert')).toBeNull();
  });
});
