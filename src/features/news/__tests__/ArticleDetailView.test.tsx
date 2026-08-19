import { render, fireEvent } from '@testing-library/react-native';
import {
  ArticleDetailView,
  type DetailStatus,
  type ReadableArticle,
} from '../ArticleDetailView';
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
  const view = await render(
    <ArticleDetailView
      status={status}
      article={article}
      onRetry={onRetry}
      isSaved={false}
      onToggleSave={onToggleSave}
      {...extra}
    />,
  );
  return { onRetry, onToggleSave, view };
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
