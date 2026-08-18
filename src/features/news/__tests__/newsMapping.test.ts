import {
  htmlToParagraphs,
  mapArticle,
  mapArticleDetail,
  parseArticleList,
  pickImageUrl,
  type TadevelArticle,
} from '../newsMapping';

const photoAsset = {
  id: 'asset1',
  files: [
    { url: 'https://cdn/t180.jpeg', width: 180, height: 180, tag: 't180' },
    { url: 'https://cdn/t720.jpeg', width: 720, height: 720, tag: 't720' },
    { url: 'https://cdn/t360.jpeg', width: 360, height: 360, tag: 't360' },
  ],
};

function article(overrides: Partial<TadevelArticle> = {}): TadevelArticle {
  return {
    id: '6a51',
    kicker: 'Deportes',
    title: 'Fecha doble para la Fórmula',
    deck: 'Este fin de semana en Azul',
    date: '2026-07-10T23:58:13.100Z',
    url: 'https://lu32.com.ar/nota/fecha-doble',
    photoAsset,
    // Deliberately broken by Tadevel — must be ignored:
    thumbnailUrl: 'https://flex-app.tadevel-cdn.com/hostname/undefined/api/v1/resizer?x=1',
    ...overrides,
  };
}

describe('pickImageUrl', () => {
  it('selects the largest-width file for a crisp card image', () => {
    expect(pickImageUrl(photoAsset)).toBe('https://cdn/t720.jpeg');
  });

  it('returns undefined when there is no usable photo asset', () => {
    expect(pickImageUrl(null)).toBeUndefined();
    expect(pickImageUrl({ id: 'x', files: [] })).toBeUndefined();
  });
});

describe('mapArticle', () => {
  it('maps the Tadevel article onto a NewsItem', () => {
    const item = mapArticle(article());
    expect(item.id).toBe('6a51');
    expect(item.title).toBe('Fecha doble para la Fórmula');
    expect(item.summary).toBe('Este fin de semana en Azul');
    expect(item.kicker).toBe('Deportes');
    expect(item.publishedAt).toBe('2026-07-10T23:58:13.100Z');
    expect(item.webUrl).toBe('https://lu32.com.ar/nota/fecha-doble');
  });

  it('uses photoAsset for the image, never the broken thumbnailUrl', () => {
    expect(mapArticle(article()).imageUrl).toBe('https://cdn/t720.jpeg');
  });

  it('falls back to an empty summary when the deck is missing', () => {
    expect(mapArticle(article({ deck: undefined })).summary).toBe('');
  });
});

describe('parseArticleList', () => {
  it('maps every article in the response payload', () => {
    const items = parseArticleList({ data: [article({ id: 'a' }), article({ id: 'b' })] });
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('returns an empty list when the payload has no data', () => {
    expect(parseArticleList({})).toEqual([]);
    expect(parseArticleList({ data: [] })).toEqual([]);
  });
});

describe('htmlToParagraphs', () => {
  it('splits <p> blocks into separate paragraphs', () => {
    expect(htmlToParagraphs('<p>Primero</p><p>Segundo</p>')).toEqual(['Primero', 'Segundo']);
  });

  it('turns <br> into line breaks within a paragraph', () => {
    expect(htmlToParagraphs('<p>1 Montoya<br>2 Escudero</p>')).toEqual(['1 Montoya\n2 Escudero']);
  });

  it('decodes common HTML entities', () => {
    expect(htmlToParagraphs('<p>Tom &amp; Jerry&nbsp;llegan</p>')).toEqual(['Tom & Jerry llegan']);
  });

  it('drops empty / whitespace-only paragraphs', () => {
    expect(htmlToParagraphs('<p>&nbsp;</p><p>Contenido real</p>')).toEqual(['Contenido real']);
  });

  it('strips stray inline tags', () => {
    expect(htmlToParagraphs('<p>Hola <b>mundo</b></p>')).toEqual(['Hola mundo']);
  });

  it('returns an empty array for empty input', () => {
    expect(htmlToParagraphs('')).toEqual([]);
    expect(htmlToParagraphs(undefined)).toEqual([]);
  });
});

describe('mapArticleDetail', () => {
  it('extends the news item with body paragraphs from bodyHtml', () => {
    const detail = mapArticleDetail(article({ bodyHtml: '<p>Uno</p><p>Dos</p>' }));
    expect(detail.title).toBe('Fecha doble para la Fórmula');
    expect(detail.imageUrl).toBe('https://cdn/t720.jpeg');
    expect(detail.paragraphs).toEqual(['Uno', 'Dos']);
  });

  it('yields no paragraphs when bodyHtml is absent', () => {
    expect(mapArticleDetail(article()).paragraphs).toEqual([]);
  });
});
