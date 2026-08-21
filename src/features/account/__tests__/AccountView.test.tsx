import { render, fireEvent } from '@testing-library/react-native';
import { AccountView } from '../AccountView';
import { accountSections } from '../accountMenu';

async function renderView(
  props: Partial<React.ComponentProps<typeof AccountView>> = {},
) {
  const spies = {
    onSelectItem: jest.fn(),
    onSignIn: jest.fn(),
    onSignUp: jest.fn(),
    onSignOut: jest.fn(),
  };
  const view = await render(
    <AccountView
      session={{ isAnonymous: false, email: 'martin@gmail.com' }}
      sections={accountSections('dark')}
      {...spies}
      {...props}
    />,
  );
  return { ...spies, view };
}

describe('before the session is known', () => {
  it('shows neither a menu nor a pitch', async () => {
    // Guessing wrong for a frame means either offering an account to someone
    // who has one, or offering settings to someone who does not.
    const { view } = await renderView({ session: null });

    expect(view.getByLabelText('Cargando cuenta')).toBeTruthy();
    expect(view.queryByLabelText('Entrar')).toBeNull();
  });
});

describe('without an account', () => {
  const anonymous = { isAnonymous: true, email: null };

  it('leads with both doors', async () => {
    const { view } = await renderView({ session: anonymous });

    expect(view.getByLabelText('Entrar')).toBeTruthy();
    expect(view.getByLabelText('Crear cuenta')).toBeTruthy();
  });

  it('says what an account is for', async () => {
    const { view } = await renderView({ session: anonymous });

    expect(view.getByText(/celular/i)).toBeTruthy();
  });

  it('shows no settings to configure', async () => {
    // There is nothing behind them yet: the settings belong to an account.
    const { view } = await renderView({ session: anonymous });

    expect(view.queryByText('Seguridad')).toBeNull();
    expect(view.queryByLabelText('Cerrar sesión')).toBeNull();
  });

  it('reports each door separately', async () => {
    const { onSignIn, onSignUp, view } = await renderView({ session: anonymous });

    await fireEvent.press(view.getByLabelText('Entrar'));
    await fireEvent.press(view.getByLabelText('Crear cuenta'));

    expect(onSignIn).toHaveBeenCalledTimes(1);
    expect(onSignUp).toHaveBeenCalledTimes(1);
  });
});

describe('with an account', () => {
  it('names the account you are on', async () => {
    const { view } = await renderView();

    expect(view.getByText('martin@gmail.com')).toBeTruthy();
  });

  it('groups the settings under their headings', async () => {
    const { view } = await renderView();

    expect(view.getByText('Seguridad')).toBeTruthy();
    expect(view.getByText('Notas')).toBeTruthy();
    expect(view.getByText('Visual')).toBeTruthy();
  });

  it('opens a row that is built', async () => {
    const { onSelectItem, view } = await renderView();

    await fireEvent.press(view.getByLabelText('Notas guardadas'));

    expect(onSelectItem).toHaveBeenCalledWith('saved-articles');
  });

  it('opens the security row, which is built', async () => {
    const { onSelectItem, view } = await renderView();

    await fireEvent.press(view.getByLabelText('Cambiar contraseña'));

    expect(onSelectItem).toHaveBeenCalledWith('change-password');
  });

  it('opens the theme row, which is built now', async () => {
    // It used to render inert and say "Próximamente". There is a picker behind
    // it now, so the row opens like any other.
    const { onSelectItem, view } = await renderView();

    await fireEvent.press(view.getByLabelText('Tema'));

    expect(onSelectItem).toHaveBeenCalledWith('theme');
  });

  it('promises nothing that is not there', async () => {
    // Every row leads somewhere, so nothing should be labelled as pending. The
    // inert rendering stays in the component for the next row that needs it.
    const { view } = await renderView();

    expect(view.queryByText('Próximamente')).toBeNull();
  });

  it('shows a row its current value', async () => {
    const { view } = await renderView();

    expect(view.getByText('Oscuro')).toBeTruthy();
  });

  it('is the one place that signs you out', async () => {
    // Moved off the saved-articles screen: that screen is about notes, and a
    // destructive session action does not belong beside them.
    const { onSignOut, view } = await renderView();

    await fireEvent.press(view.getByLabelText('Cerrar sesión'));

    expect(onSignOut).toHaveBeenCalledTimes(1);
  });
});
