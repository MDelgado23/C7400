import { StyleSheet } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import {
  ArticleDetailView,
  type DetailStatus,
  type ReadableArticle,
} from '../ArticleDetailView';
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

// The old frame was a fixed 200pt band: every photo was cropped into a 2:1 box,
// which for the 12% of them that are portrait meant showing a slice. The frame
// is shaped like the photo now, and what will not fit opens on its own.
describe('the photo', () => {
  it('takes the shape of the photo it is showing', async () => {
    const { view } = await renderView('ready', { ...detail, imageAspectRatio: 0.75 });

    const style = StyleSheet.flatten(view.getByTestId('article-photo').props.style);

    expect(style.aspectRatio).toBeCloseTo(0.75, 3);
  });

  // Nothing to derive a shape from, so it falls back to the one most of the
  // newsroom's photos have rather than to an arbitrary band.
  it('falls back to a common shape when the photo has none', async () => {
    const { view } = await renderView('ready', { ...detail, imageAspectRatio: undefined });

    const style = StyleSheet.flatten(view.getByTestId('article-photo').props.style);

    expect(style.aspectRatio).toBe(DEFAULT_ASPECT_RATIO);
  });

  // A very tall photo shaped honestly would push the headline off the screen,
  // so the frame is capped and the rest is one tap away.
  it('never lets the photo take the whole screen', async () => {
    const { view } = await renderView('ready', { ...detail, imageAspectRatio: 0.4 });

    const style = StyleSheet.flatten(view.getByTestId('article-photo').props.style);

    expect(style.maxHeight).toBeGreaterThan(0);
  });

  it('opens the photo on its own when tapped', async () => {
    const { onOpenPhoto, view } = await renderView('ready', detail);

    await fireEvent.press(view.getByLabelText('Ver la foto completa'));

    expect(onOpenPhoto).toHaveBeenCalledWith('https://cdn/t720.jpeg');
  });

  it('offers nothing to open when the note has no photo', async () => {
    const { view } = await renderView('ready', { ...detail, imageUrl: undefined });

    expect(view.queryByLabelText('Ver la foto completa')).toBeNull();
  });
});
