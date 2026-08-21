import { StyleSheet } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { MiniPlayerView } from '../MiniPlayerView';
import { palettes } from '../../theme';
import type { PlayerState } from '../../../core/store/playerStore';

// RNTL v14 note: render() is async — it returns a Promise of the query bag.
async function renderView(state: PlayerState, title = 'La Mañana de LU32') {
  const onToggle = jest.fn();
  const view = await render(
    <MiniPlayerView state={state} title={title} onToggle={onToggle} />,
  );
  return { onToggle, view };
}

describe('the play/pause control', () => {
  /*
   * Painted with `control`, which is the ONE token for the play/pause
   * affordance wherever it appears — here as a bare glyph, and on the Radio
   * screen as the fill of the big round button. The bar is otherwise all text,
   * and this is its one live control, so it gets a colour of its own rather
   * than reading as another line of copy.
   *
   * The token's two values diverge on purpose; `tokens.test.ts` is where that
   * is argued and measured. What THIS file pins down is only the wiring: the
   * icon follows `control`, and is not `text` any more.
   *
   * Default theme here, so this reads the dark palette.
   */
  const colorOf = (element: { props?: { color?: unknown; style?: unknown } }) => {
    const fromProp = element.props?.color;
    if (typeof fromProp === 'string') return fromProp;
    const flat = StyleSheet.flatten(element.props?.style as never) as
      | { color?: string; borderTopColor?: string }
      | undefined;
    // `borderTopColor` because a Spinner has no glyph to paint: it IS a ring,
    // and its bright arc is the top border over a faint track.
    return flat?.color ?? flat?.borderTopColor;
  };

  const iconUnder = (element: {
    props?: { color?: unknown; style?: unknown };
    children?: unknown[];
  }): (string | undefined)[] => {
    const found = [colorOf(element)];
    for (const child of element.children ?? []) {
      if (child !== null && typeof child === 'object') {
        found.push(...iconUnder(child as Parameters<typeof iconUnder>[0]));
      }
    }
    return found;
  };

  it.each([
    ['paused', 'Reproducir'],
    ['playing', 'Pausar'],
  ] as const)('paints the %s icon with the active-tab colour', async (state, label) => {
    const { view } = await renderView(state);

    const painted = iconUnder(view.getByLabelText(label));

    expect(painted).toContain(palettes.dark.control);
    expect(painted).not.toContain(palettes.dark.text);
  });

  // The same control, one state later. Letting the spinner keep the old colour
  // would make the button change colour every time the stream reconnects.
  it('keeps that colour while the stream is still loading', async () => {
    const { view } = await renderView('buffering');

    expect(iconUnder(view.getByLabelText('Cargando'))).toContain(palettes.dark.control);
  });
});

describe('MiniPlayerView', () => {
  it('shows the current program title', async () => {
    const { view } = await renderView('playing', 'Deportes Total');
    expect(view.getByText('Deportes Total')).toBeTruthy();
  });

  it('offers a Reproducir control when stopped/paused', async () => {
    const { view } = await renderView('paused');
    expect(view.getByLabelText('Reproducir')).toBeTruthy();
  });

  it('offers a Pausar control when audio is active', async () => {
    const { view } = await renderView('playing');
    expect(view.getByLabelText('Pausar')).toBeTruthy();
  });

  it('invokes onToggle when the control is pressed', async () => {
    const { onToggle, view } = await renderView('paused');
    fireEvent.press(view.getByLabelText('Reproducir'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('shows a loading affordance while buffering', async () => {
    const { view } = await renderView('buffering');
    expect(view.getByLabelText('Cargando')).toBeTruthy();
  });

  it('shows the station logo as artwork when no program image is provided', async () => {
    const { view } = await renderView('playing');
    expect(view.getByLabelText('Logo de LU32')).toBeTruthy();
  });

  it('invokes onPress when the bar body (not the control) is tapped', async () => {
    const onPress = jest.fn();
    const onToggle = jest.fn();
    const view = await render(
      <MiniPlayerView
        state="playing"
        title="La Mañana de LU32"
        onToggle={onToggle}
        onPress={onPress}
      />,
    );
    fireEvent.press(view.getByTestId('mini-player-bar'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('invokes onToggle (not onPress) when the play/pause control is tapped', async () => {
    const onPress = jest.fn();
    const onToggle = jest.fn();
    const view = await render(
      <MiniPlayerView
        state="paused"
        title="La Mañana de LU32"
        onToggle={onToggle}
        onPress={onPress}
      />,
    );
    fireEvent.press(view.getByLabelText('Reproducir'));
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();
  });
});
