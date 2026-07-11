import { render, fireEvent } from '@testing-library/react-native';
import { MiniPlayerView } from '../MiniPlayerView';
import type { PlayerState } from '../../../core/store/playerStore';

// RNTL v14 note: render() is async — it returns a Promise of the query bag.
async function renderView(state: PlayerState, title = 'La Mañana de LU32') {
  const onToggle = jest.fn();
  const view = await render(
    <MiniPlayerView state={state} title={title} onToggle={onToggle} />,
  );
  return { onToggle, view };
}

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
});
