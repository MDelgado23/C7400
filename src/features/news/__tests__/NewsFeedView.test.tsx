import { render, fireEvent } from '@testing-library/react-native';
import { NewsFeedView, resolveFeedStatus, type FeedStatus } from '../NewsFeedView';
import type { NewsItem } from '../newsMapping';

const items: NewsItem[] = [
  { id: 'a', title: 'Fórmula en Azul', summary: 's', kicker: 'Deportes', publishedAt: '2026-07-10T00:00:00Z' },
  { id: 'b', title: 'El Concejo delibera', summary: 's', publishedAt: '2026-07-09T00:00:00Z' },
];

async function renderView(status: FeedStatus, data: NewsItem[] = []) {
  const onRetry = jest.fn();
  const onSelectArticle = jest.fn();
  const view = await render(
    <NewsFeedView
      status={status}
      items={data}
      onRetry={onRetry}
      onSelectArticle={onSelectArticle}
    />,
  );
  return { onRetry, onSelectArticle, view };
}

describe('NewsFeedView', () => {
  it('shows a loading indicator while fetching', async () => {
    const { view } = await renderView('loading');
    expect(view.getByLabelText('Cargando noticias')).toBeTruthy();
  });

  it('shows an error message with retry when the request fails', async () => {
    const { onRetry, view } = await renderView('error');
    expect(view.getByText('No pudimos cargar las noticias')).toBeTruthy();
    fireEvent.press(view.getByLabelText('Reintentar'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows an empty message when there are no articles', async () => {
    const { view } = await renderView('empty');
    expect(view.getByText('No hay noticias por ahora')).toBeTruthy();
  });

  it('lists article titles when the feed is ready', async () => {
    const { view } = await renderView('ready', items);
    expect(view.getByText('Fórmula en Azul')).toBeTruthy();
    expect(view.getByText('El Concejo delibera')).toBeTruthy();
  });

  it('selects an article when its card is pressed', async () => {
    const { onSelectArticle, view } = await renderView('ready', items);
    fireEvent.press(view.getByTestId('article-a'));
    expect(onSelectArticle).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }));
  });
});

describe('resolveFeedStatus (pure query state → status)', () => {
  it('is loading while the query is loading', () => {
    expect(resolveFeedStatus({ isLoading: true, isError: false, count: 0 })).toBe('loading');
  });

  it('is error when the query failed', () => {
    expect(resolveFeedStatus({ isLoading: false, isError: true, count: 0 })).toBe('error');
  });

  it('is empty when loaded with no articles', () => {
    expect(resolveFeedStatus({ isLoading: false, isError: false, count: 0 })).toBe('empty');
  });

  it('is ready when there are articles', () => {
    expect(resolveFeedStatus({ isLoading: false, isError: false, count: 3 })).toBe('ready');
  });
});
