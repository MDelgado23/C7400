import { render, fireEvent } from '@testing-library/react-native';
import { BackgroundPlaybackNotice } from '../BackgroundPlaybackNotice';

async function renderNotice() {
  const onEnable = jest.fn();
  const view = await render(<BackgroundPlaybackNotice onEnable={onEnable} />);
  return { onEnable, view };
}

describe('BackgroundPlaybackNotice', () => {
  it('explains that background playback may be interrupted', async () => {
    const { view } = await renderNotice();
    expect(view.getByText(/segundo plano/i)).toBeTruthy();
  });

  it('invokes onEnable when the user taps the enable action', async () => {
    const { onEnable, view } = await renderNotice();
    fireEvent.press(view.getByLabelText('Activar reproducción en segundo plano'));
    expect(onEnable).toHaveBeenCalledTimes(1);
  });

  it('is not dismissible: it exposes no dismiss control', async () => {
    const { view } = await renderNotice();
    expect(view.queryByLabelText('Descartar aviso')).toBeNull();
  });
});
