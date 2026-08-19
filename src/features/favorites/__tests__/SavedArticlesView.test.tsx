import { render, fireEvent } from '@testing-library/react-native';
import { SavedArticlesView, resolveSavedStatus } from '../SavedArticlesView';
import type { SavedArticle } from '../../../core/favorites/savedArticle';

function saved(id: string, title = `Nota ${id}`): SavedArticle {
  return {
    id,
    title,
    summary: 'Alerta amarilla.',
    kicker: 'Clima',
    publishedAt: '2026-08-19T10:00:00Z',
    paragraphs: ['Primer párrafo.'],
    savedAt: 1_700_000_000_000,
  };
}

async function renderView(
  props: Partial<React.ComponentProps<typeof SavedArticlesView>> = {},
) {
  const onSelectArticle = jest.fn();
  const onRemove = jest.fn();
  const onPressAccount = jest.fn();
  const view = await render(
    <SavedArticlesView
      status="ready"
      articles={[saved('a-1')]}
      onSelectArticle={onSelectArticle}
      onRemove={onRemove}
      account={null}
      onPressAccount={onPressAccount}
      {...props}
    />,
  );
  return { onSelectArticle, onRemove, onPressAccount, view };
}

const anonPrompt = {
  message: 'Estas notas viven solo en este celular.',
  actions: [
    { intent: 'signup' as const, label: 'Crear cuenta' },
    { intent: 'signin' as const, label: 'Entrar' },
  ],
};

/**
 * A signed-in user gets NO row here at all — session management moved to the
 * Cuenta tab. `accountPromptFor` returns null for them, so the screen simply
 * renders the notes.
 */
const signedInPrompt = null;

describe('resolveSavedStatus', () => {
  it('is loading until the list has arrived', () => {
    // An empty list means "nothing saved" only once it has actually loaded.
    // Without this the screen tells every visitor they have saved nothing, for
    // the split second before their articles appear.
    expect(resolveSavedStatus({ loaded: false, count: 0 })).toBe('loading');
  });

  it('is empty once the list arrived with nothing in it', () => {
    expect(resolveSavedStatus({ loaded: true, count: 0 })).toBe('empty');
  });

  it('is ready when there is something to show', () => {
    expect(resolveSavedStatus({ loaded: true, count: 3 })).toBe('ready');
  });

  it('shows what it has rather than a spinner over real articles', () => {
    // The Firestore cache can deliver before the flag flips. Articles on screen
    // beat a spinner every time.
    expect(resolveSavedStatus({ loaded: false, count: 3 })).toBe('ready');
  });
});

describe('SavedArticlesView', () => {
  it('shows a loading affordance', async () => {
    const { view } = await renderView({ status: 'loading', articles: [] });

    expect(view.getByLabelText('Cargando guardadas')).toBeTruthy();
  });

  it('explains how to save when there is nothing yet', async () => {
    // An empty screen that only says "vacío" leaves the user with no idea the
    // feature exists, let alone how to use it.
    const { view } = await renderView({ status: 'empty', articles: [] });

    expect(view.getByText(/Guardá/)).toBeTruthy();
  });

  it('lists the saved articles', async () => {
    const { view } = await renderView({
      status: 'ready',
      articles: [saved('a-1', 'Se viene el temporal'), saved('a-2', 'Ganó Olimpo')],
    });

    expect(view.getByText('Se viene el temporal')).toBeTruthy();
    expect(view.getByText('Ganó Olimpo')).toBeTruthy();
  });

  it('opens the article that was tapped', async () => {
    const { onSelectArticle, view } = await renderView();

    await fireEvent.press(view.getByTestId('saved-a-1'));

    expect(onSelectArticle).toHaveBeenCalledWith(expect.objectContaining({ id: 'a-1' }));
  });

  it('shows nothing about the account when there is no session yet', async () => {
    const { view } = await renderView({ account: null });

    expect(view.queryByLabelText('Crear cuenta')).toBeNull();
    expect(view.queryByLabelText('Cerrar sesión')).toBeNull();
  });

  it('offers the account permanently, not just once after a save', async () => {
    // The gap this closes: the contextual sheet fires once per session, so
    // someone who declined it had no route to an account left anywhere.
    const { view } = await renderView({ account: anonPrompt });

    expect(view.getByText('Estas notas viven solo en este celular.')).toBeTruthy();
    expect(view.getByLabelText('Crear cuenta')).toBeTruthy();
  });

  it('puts signing in next to signing up, not behind it', async () => {
    // Someone who reinstalled the app already has an account. Before this, the
    // only route to a login was: "Crear cuenta" → "Volver" → "Ya tengo una
    // cuenta". Three taps through a form they never wanted.
    const { onPressAccount, view } = await renderView({ account: anonPrompt });

    await fireEvent.press(view.getByLabelText('Entrar'));

    expect(onPressAccount).toHaveBeenCalledWith('signin');
  });

  it('offers the account on the empty screen too', async () => {
    // Where it matters MOST: someone with nothing saved is exactly who has not
    // discovered the feature, and the empty screen is the one they will see.
    const { view } = await renderView({ status: 'empty', articles: [], account: anonPrompt });

    expect(view.getByLabelText('Crear cuenta')).toBeTruthy();
  });

  it('shows a signed-in user nothing about their session', async () => {
    // It moved to the Cuenta tab. This screen is about notes, and a "Cerrar
    // sesión" above them was one mistap away from emptying the very list it
    // was attached to.
    const { view } = await renderView({ account: signedInPrompt });

    expect(view.queryByLabelText('Cerrar sesión')).toBeNull();
    expect(view.queryByLabelText('Crear cuenta')).toBeNull();
  });

  it('reports which door was taken', async () => {
    const { onPressAccount, view } = await renderView({ account: anonPrompt });

    await fireEvent.press(view.getByLabelText('Crear cuenta'));

    expect(onPressAccount).toHaveBeenCalledWith('signup');
  });

  it('removes without opening the article', async () => {
    // The remove control sits inside the row. If the tap fell through, the user
    // would delete an article and land in it at the same time.
    const { onSelectArticle, onRemove, view } = await renderView();

    await fireEvent.press(view.getByLabelText('Quitar Nota a-1 de guardadas'));

    expect(onRemove).toHaveBeenCalledWith('a-1');
    expect(onSelectArticle).not.toHaveBeenCalled();
  });
});
