import { render, fireEvent } from '@testing-library/react-native';
import { ThemeView } from '../ThemeView';
import type { ThemePreference } from '../../../core/theme/themePreference';

async function renderView(preference: ThemePreference = 'dark') {
  const onSelect = jest.fn();
  const view = await render(<ThemeView preference={preference} onSelect={onSelect} />);
  return { onSelect, view };
}

describe('the choices offered', () => {
  it('shows all three, named in Spanish', async () => {
    const { view } = await renderView();

    expect(view.getByLabelText('Automático')).toBeTruthy();
    expect(view.getByLabelText('Claro')).toBeTruthy();
    expect(view.getByLabelText('Oscuro')).toBeTruthy();
  });

  it('says what automatic actually does', async () => {
    // "Automático" on its own is a promise with no content — automatic
    // according to what? The row has to say it follows the phone, or the user
    // has to tap it to find out and then tap back.
    const { view } = await renderView();

    expect(view.getByText(/sigue la configuración de tu teléfono/i)).toBeTruthy();
  });

  it('says where the choice is kept', async () => {
    // The whole reason this is stored twice. Somebody who signs in on a second
    // phone should not be surprised to find it already themed.
    const { view } = await renderView();

    expect(view.getByText(/en tu cuenta/i)).toBeTruthy();
  });
});

describe('showing which one is on', () => {
  it('marks the current choice as checked', async () => {
    const { view } = await renderView('light');

    expect(view.getByLabelText('Claro')).toBeChecked();
  });

  it('leaves the others unselected', async () => {
    // Announced through accessibilityState, not just a tick glyph: a checkmark
    // is invisible to a screen reader, and this screen is nothing BUT a choice.
    const { view } = await renderView('light');

    expect(view.getByLabelText('Oscuro')).not.toBeChecked();
    expect(view.getByLabelText('Automático')).not.toBeChecked();
  });

  it('moves the mark when the choice moves', async () => {
    const { view } = await renderView('system');

    expect(view.getByLabelText('Automático')).toBeChecked();
    expect(view.getByLabelText('Claro')).not.toBeChecked();
  });
});

describe('choosing', () => {
  it('reports the preference, not the label', async () => {
    // The container stores what comes out of here. A Spanish label reaching the
    // port would be written to Firestore and rejected on the way back out.
    const { onSelect, view } = await renderView();

    await fireEvent.press(view.getByLabelText('Claro'));

    expect(onSelect).toHaveBeenCalledWith('light');
  });

  it('reports automatic as automatic, not as a resolved scheme', async () => {
    // 'system' has to survive the trip. Storing the resolved 'light' instead
    // would silently turn "follow my phone" into "always light".
    const { onSelect, view } = await renderView('dark');

    await fireEvent.press(view.getByLabelText('Automático'));

    expect(onSelect).toHaveBeenCalledWith('system');
  });

  it('still reports a tap on the row that is already selected', async () => {
    // Swallowing it would be a silent no-op on the only control on screen. If
    // the stored value and the painted one ever disagree, this is the tap that
    // resolves it.
    const { onSelect, view } = await renderView('dark');

    await fireEvent.press(view.getByLabelText('Oscuro'));

    expect(onSelect).toHaveBeenCalledWith('dark');
  });

  it('does not decide anything on its own', async () => {
    // Presentational. It renders what it is told and reports taps; the port is
    // the only thing that changes state.
    const { onSelect } = await renderView();

    expect(onSelect).not.toHaveBeenCalled();
  });
});
