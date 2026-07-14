import { render, fireEvent } from '@testing-library/react-native';
import { PlayerScreenView } from '../PlayerScreenView';
import type { PlayerState } from '../../../core/store/playerStore';

async function renderView(state: PlayerState, title = 'La Mañana de LU32') {
  const onToggle = jest.fn();
  const onRetry = jest.fn();
  const view = await render(
    <PlayerScreenView
      state={state}
      title={title}
      onToggle={onToggle}
      onRetry={onRetry}
    />,
  );
  return { onToggle, onRetry, view };
}

describe('PlayerScreenView', () => {
  it('shows the current program and station name', async () => {
    const { view } = await renderView('playing', 'Deportes Total');
    expect(view.getByText('Deportes Total')).toBeTruthy();
    expect(view.getByText('LU32 en vivo')).toBeTruthy();
  });

  it('offers Reproducir when paused', async () => {
    const { view } = await renderView('paused');
    expect(view.getByLabelText('Reproducir')).toBeTruthy();
  });

  it('offers Pausar when playing', async () => {
    const { view } = await renderView('playing');
    expect(view.getByLabelText('Pausar')).toBeTruthy();
  });

  it('invokes onToggle when the main control is pressed', async () => {
    const { onToggle, view } = await renderView('paused');
    fireEvent.press(view.getByLabelText('Reproducir'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('shows a loading affordance while buffering', async () => {
    const { view } = await renderView('buffering');
    expect(view.getByLabelText('Cargando')).toBeTruthy();
  });

  it('shows an error message with a retry action when the stream fails', async () => {
    const { onRetry, view } = await renderView('error');
    expect(view.getByText('No pudimos conectar con la radio')).toBeTruthy();
    fireEvent.press(view.getByLabelText('Reintentar'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('replaces the play control with retry in the error state', async () => {
    const { view } = await renderView('error');
    expect(view.queryByLabelText('Reproducir')).toBeNull();
    expect(view.queryByLabelText('Pausar')).toBeNull();
  });

  it('hides the background-playback notice by default', async () => {
    const { view } = await renderView('playing');
    expect(
      view.queryByLabelText('Activar reproducción en segundo plano'),
    ).toBeNull();
  });

  it('shows the background-playback notice and wires its actions when at risk', async () => {
    const onEnableBackground = jest.fn();
    const onDismissBackground = jest.fn();
    const view = await render(
      <PlayerScreenView
        state="playing"
        title="La Mañana de LU32"
        onToggle={jest.fn()}
        onRetry={jest.fn()}
        backgroundNoticeVisible
        onEnableBackground={onEnableBackground}
        onDismissBackground={onDismissBackground}
      />,
    );
    fireEvent.press(
      view.getByLabelText('Activar reproducción en segundo plano'),
    );
    fireEvent.press(view.getByLabelText('Descartar aviso'));
    expect(onEnableBackground).toHaveBeenCalledTimes(1);
    expect(onDismissBackground).toHaveBeenCalledTimes(1);
  });
});
