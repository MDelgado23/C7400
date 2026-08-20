import { SafeAreaProvider } from 'react-native-safe-area-context';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { PhotoViewer } from '../PhotoViewer';

const PHOTO = 'https://cdn/720.webp';

/**
 * An Android phone with the three-button navigation bar. The viewer draws edge
 * to edge and reads these to keep its controls clear of the system bars, and
 * `useSafeAreaInsets` throws outright without a provider above it.
 */
const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 24, left: 0, right: 0, bottom: 48 },
};

async function renderViewer(uri: string | null = PHOTO) {
  const onClose = jest.fn();
  await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <PhotoViewer uri={uri} onClose={onClose} />
    </SafeAreaProvider>,
  );
  return { onClose };
}

describe('PhotoViewer', () => {
  it('shows the photo it was given', async () => {
    await renderViewer();

    expect(screen.getByTestId('photo-viewer-image').props.source).toEqual({ uri: PHOTO });
  });

  // The whole point of opening it: the article's frame crops to fit the page,
  // this one does not crop at all.
  it('shows the whole photo rather than filling the screen with part of it', async () => {
    await renderViewer();

    expect(screen.getByTestId('photo-viewer-image').props.resizeMode).toBe('contain');
  });

  it('can be closed', async () => {
    const { onClose } = await renderViewer();

    await fireEvent.press(screen.getByLabelText('Cerrar'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // Null is "no photo open". Mounting the image anyway would keep the last
  // photo alive behind a closed sheet and hand it to a screen reader.
  it('shows nothing at all when no photo is open', async () => {
    await renderViewer(null);

    expect(screen.queryByTestId('photo-viewer-image')).toBeNull();
  });

  it('tells the reader what the gesture does', async () => {
    await renderViewer();

    expect(screen.getByLabelText(/Pellizcá para ampliar/)).toBeTruthy();
  });
});
