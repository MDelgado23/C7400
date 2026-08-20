import { render, fireEvent } from '@testing-library/react-native';
import { NewsFeedView, resolveFeedStatus, type FeedStatus } from '../NewsFeedView';
import type { NewsItem } from '../newsMapping';

const NOW = Date.parse('2026-07-10T12:00:00Z');

const items: NewsItem[] = [
  { id: 'a', title: 'Fórmula en Azul', summary: 's', kicker: 'Deportes', publishedAt: '2026-07-10T09:00:00Z' },
  { id: 'b', title: 'El Concejo delibera', summary: 's', publishedAt: '2026-07-09T00:00:00Z' },
];

beforeEach(() => {
  jest.spyOn(Date, 'now').mockReturnValue(NOW);
});

afterEach(() => {
  jest.restoreAllMocks();
});

async function renderView(status: FeedStatus, data: NewsItem[] = []) {
  const onRetry = jest.fn();
  const onSelectArticle = jest.fn();
  const onRefresh = jest.fn();
  const view = await render(
    <NewsFeedView
      status={status}
      items={data}
      onRetry={onRetry}
      onSelectArticle={onSelectArticle}
      refreshing={false}
      onRefresh={onRefresh}
    />,
  );
  return { onRetry, onSelectArticle, onRefresh, view };
}

describe('NewsFeedView', () => {
  it('shows a loading indicator while fetching', async () => {
    const { view } = await renderView('loading');
    expect(view.getByLabelText('Cargando noticias')).toBeTruthy();
  });

  it('shows an error message with retry when the request fails', async () => {
    const { onRetry, view } = await renderView('error');
    expect(view.getByText('No pudimos cargar las noticias')).toBeTruthy();
    await fireEvent.press(view.getByLabelText('Reintentar'));
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
    await fireEvent.press(view.getByTestId('article-a'));
    expect(onSelectArticle).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }));
  });

  describe('the publication time on the card', () => {
    // Without it a note from three hours ago and one from yesterday look
    // identical, which on a radio's feed loses half of what makes it worth
    // opening.
    it('shows how long ago each note was published', async () => {
      const { view } = await renderView('ready', items);

      expect(view.getByText('hace 3 h')).toBeTruthy();
      expect(view.getByText('ayer')).toBeTruthy();
    });

    // Nothing beats something wrong: the line is simply absent.
    it('shows no time at all when the date cannot be read', async () => {
      const { view } = await renderView('ready', [{ ...items[0], publishedAt: 'cuando sea' }]);

      expect(view.queryByTestId('published-a')).toBeNull();
      expect(view.getByText('Fórmula en Azul')).toBeTruthy();
    });
  });

  describe('pull to refresh', () => {
    // The gesture everybody makes on a feed by reflex. Until now it did
    // nothing at all.
    it('asks for fresh news when the list is pulled down', async () => {
      const { onRefresh, view } = await renderView('ready', items);

      await fireEvent(view.getByTestId('news-list'), 'refresh');

      expect(onRefresh).toHaveBeenCalledTimes(1);
    });
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
