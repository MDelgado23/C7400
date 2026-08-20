import { StyleSheet } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import {
  ArticleDetailView,
  type DetailStatus,
  type ReadableArticle,
} from '../ArticleDetailView';
import { HERO_BAND_RATIO } from '../ArticleDetailView';
import { DEFAULT_ASPECT_RATIO } from '../photoAsset';
import type { ArticleDetail } from '../newsMapping';

const detail: ArticleDetail = {
  id: 'a',
  title: 'Fecha doble para la Fórmula',
  summary: 'Este fin de semana en Azul',
  kicker: 'Deportes',
  imageUrl: 'https://cdn/t720.jpeg',
  publishedAt: '2026-07-10T00:00:00Z',
  webUrl: 'https://lu32.com.ar/nota/x',
  paragraphs: ['Primer párrafo de la nota.', 'Segundo párrafo de la nota.'],
};

async function renderView(
  status: DetailStatus,
  article?: ReadableArticle,
  extra: Partial<React.ComponentProps<typeof ArticleDetailView>> = {},
) {
  const onRetry = jest.fn();
  const onToggleSave = jest.fn();
  const onOpenPhoto = jest.fn();
  // Built as an object so `extra` can override any of these without the spread
  // making the required props look optional to the type checker.
  const props = {
    status,
    article,
    onRetry,
    isSaved: false,
    onToggleSave,
    onOpenPhoto,
    ...extra,
  } as React.ComponentProps<typeof ArticleDetailView>;
  const view = await render(<ArticleDetailView {...props} />);
  return { onRetry, onToggleSave, onOpenPhoto, view };
}

describe('ArticleDetailView', () => {
  it('shows a loading indicator while fetching the article', async () => {
    const { view } = await renderView('loading');
    expect(view.getByLabelText('Cargando nota')).toBeTruthy();
  });

  it('shows an error with retry when the article fails to load', async () => {
    const { onRetry, view } = await renderView('error');
    expect(view.getByText('No pudimos cargar la nota')).toBeTruthy();
    await fireEvent.press(view.getByLabelText('Reintentar'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders the article title and kicker when ready', async () => {
    const { view } = await renderView('ready', detail);
    expect(view.getByText('Fecha doble para la Fórmula')).toBeTruthy();
    expect(view.getByText('Deportes')).toBeTruthy();
  });

  it('renders every body paragraph', async () => {
    const { view } = await renderView('ready', detail);
    expect(view.getByText('Primer párrafo de la nota.')).toBeTruthy();
    expect(view.getByText('Segundo párrafo de la nota.')).toBeTruthy();
  });
});

describe('saving', () => {
  it('offers to save an article that is not saved yet', async () => {
    const { view } = await renderView('ready', detail, { isSaved: false });

    expect(view.getByLabelText('Guardar nota')).toBeTruthy();
  });

  it('offers to unsave one that already is', async () => {
    // The label carries the state, so a screen reader is never told "Guardar"
    // on a control that would actually remove the article.
    const { view } = await renderView('ready', detail, { isSaved: true });

    expect(view.getByLabelText('Quitar de guardadas')).toBeTruthy();
  });

  it('reports the tap', async () => {
    const { onToggleSave, view } = await renderView('ready', detail, { isSaved: false });

    await fireEvent.press(view.getByLabelText('Guardar nota'));

    expect(onToggleSave).toHaveBeenCalledTimes(1);
  });

  it('offers nothing to save while the article is still loading', async () => {
    const { view } = await renderView('loading');

    expect(view.queryByLabelText('Guardar nota')).toBeNull();
  });
});

describe('a saved copy that was cut', () => {
  it('says so and points at the full version', async () => {
    // Silent truncation would leave the reader believing the note simply ends
    // there. Saying it — and offering the web version — is the difference
    // between a limitation and a bug.
    const { view } = await renderView('ready', { ...detail, truncated: true });

    expect(view.getByText(/recortada/i)).toBeTruthy();
  });

  it('says nothing when the article is whole', async () => {
    const { view } = await renderView('ready', detail);

    expect(view.queryByText(/recortada/i)).toBeNull();
  });
});

// A BAND, the same on every article, with the full photo one tap away in the
// viewer. Measured over a hundred of the newsroom's photos, 16:9 loses 21% of
// the average one and takes 30% of the screen — the least crop that still
// leaves the headline, the deck and the save button above the fold.
describe('the photo band', () => {
  it('is the same shape on every article', async () => {
    const tall = await renderView('ready', { ...detail, imageAspectRatio: 0.5 });
    const wide = await renderView('ready', { ...detail, imageAspectRatio: 3.2 });

    for (const view of [tall.view, wide.view]) {
      const band = StyleSheet.flatten(view.getByTestId('photo-band').props.style);
      expect(band.aspectRatio).toBeCloseTo(HERO_BAND_RATIO, 3);
    }
  });

  it('clips rather than squashing what does not fit', async () => {
    const { view } = await renderView('ready', detail);

    expect(StyleSheet.flatten(view.getByTestId('photo-band').props.style).overflow).toBe('hidden');
  });

  // THE PART THAT MATTERS ON A PORTRAIT. Drawn at its own shape and pinned to
  // the top of the band, a standing figure keeps its head and loses its feet.
  // Centred — which is what an image does by default — it would keep the torso
  // and cut the face off, on a section that is almost entirely photos of people.
  it('keeps the top of a photo that is taller than the band', async () => {
    const { view } = await renderView('ready', { ...detail, imageAspectRatio: 0.75 });

    const photo = StyleSheet.flatten(view.getByTestId('article-photo').props.style);

    expect(photo.aspectRatio).toBeCloseTo(0.75, 3);
  });

  // A photo wider than the band has nothing to gain from being pinned: it is
  // cropped left and right, and centred is where the subject is.
  it('lets a wide photo fill the band and crop at the sides', async () => {
    const { view } = await renderView('ready', { ...detail, imageAspectRatio: 3.2 });

    const photo = StyleSheet.flatten(view.getByTestId('article-photo').props.style);

    expect(photo.aspectRatio).toBeCloseTo(HERO_BAND_RATIO, 3);
  });

  it('falls back to a common shape when the photo has none', async () => {
    const { view } = await renderView('ready', { ...detail, imageAspectRatio: undefined });

    const photo = StyleSheet.flatten(view.getByTestId('article-photo').props.style);

    expect(photo.aspectRatio).toBeCloseTo(DEFAULT_ASPECT_RATIO, 3);
  });

  it('opens the photo on its own when tapped', async () => {
    const { onOpenPhoto, view } = await renderView('ready', detail);

    await fireEvent.press(view.getByLabelText('Ver la foto completa'));

    expect(onOpenPhoto).toHaveBeenCalledWith('https://cdn/t720.jpeg');
  });

  it('offers nothing to open when the note has no photo', async () => {
    const { view } = await renderView('ready', { ...detail, imageUrl: undefined });

    expect(view.queryByLabelText('Ver la foto completa')).toBeNull();
    expect(view.queryByTestId('photo-band')).toBeNull();
  });
});
