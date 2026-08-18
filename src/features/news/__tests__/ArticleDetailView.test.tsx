import { render, fireEvent } from '@testing-library/react-native';
import { ArticleDetailView, type DetailStatus } from '../ArticleDetailView';
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

async function renderView(status: DetailStatus, article?: ArticleDetail) {
  const onRetry = jest.fn();
  const view = await render(
    <ArticleDetailView status={status} article={article} onRetry={onRetry} />,
  );
  return { onRetry, view };
}

describe('ArticleDetailView', () => {
  it('shows a loading indicator while fetching the article', async () => {
    const { view } = await renderView('loading');
    expect(view.getByLabelText('Cargando nota')).toBeTruthy();
  });

  it('shows an error with retry when the article fails to load', async () => {
    const { onRetry, view } = await renderView('error');
    expect(view.getByText('No pudimos cargar la nota')).toBeTruthy();
    fireEvent.press(view.getByLabelText('Reintentar'));
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
