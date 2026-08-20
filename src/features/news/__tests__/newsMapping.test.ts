import {
  htmlToParagraphs,
  mapArticle,
  mapArticleDetail,
  parseArticleList,
  type TadevelArticle,
} from '../newsMapping';

const SITE = 'https://lu32.com.ar';

/** The shape the CDN actually serves: measurements under `metadata`. */
const photoAsset = {
  id: 'asset1',
  files: [
    { url: 'https://cdn/t360.jpeg', tag: 't360', metadata: { width: 360, height: 360, format: 'jpeg' } },
    { url: 'https://cdn/360.webp', tag: '360', metadata: { width: 270, height: 360, format: 'webp' } },
    { url: 'https://cdn/720.webp', tag: '720', metadata: { width: 540, height: 720, format: 'webp' } },
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

describe('mapArticle', () => {
  it('maps the Tadevel article onto a NewsItem', () => {
    const item = mapArticle(article(), SITE);
    expect(item.id).toBe('6a51');
    expect(item.title).toBe('Fecha doble para la Fórmula');
    expect(item.summary).toBe('Este fin de semana en Azul');
    expect(item.kicker).toBe('Deportes');
    expect(item.publishedAt).toBe('2026-07-10T23:58:13.100Z');
    expect(item.webUrl).toBe('https://lu32.com.ar/nota/fecha-doble');
  });

  it('uses photoAsset for the image, never the broken thumbnailUrl', () => {
    expect(mapArticle(article(), SITE).imageUrl).toBe('https://cdn/720.webp');
  });

  // The frame is shaped like the photo instead of cropping it into a fixed box.
  it('carries the shape of the photo', () => {
    expect(mapArticle(article(), SITE).imageAspectRatio).toBeCloseTo(540 / 720, 3);
  });

  it("uses the CDN's square crop for the card, not the full photo", () => {
    expect(mapArticle(article(), SITE).thumbUrl).toBe('https://cdn/t360.jpeg');
  });

  it('falls back to an empty summary when the deck is missing', () => {
    expect(mapArticle(article({ deck: undefined }), SITE).summary).toBe('');
  });
});

describe('parseArticleList', () => {
  it('maps every article in the response payload', () => {
    const items = parseArticleList({ data: [article({ id: 'a' }), article({ id: 'b' })] }, SITE);
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('returns an empty list when the payload has no data', () => {
    expect(parseArticleList({}, SITE)).toEqual([]);
    expect(parseArticleList({ data: [] }, SITE)).toEqual([]);
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
    const detail = mapArticleDetail(article({ bodyHtml: '<p>Uno</p><p>Dos</p>' }), SITE);
    expect(detail.title).toBe('Fecha doble para la Fórmula');
    expect(detail.imageUrl).toBe('https://cdn/720.webp');
    expect(detail.paragraphs).toEqual(['Uno', 'Dos']);
  });

  it('yields no paragraphs when bodyHtml is absent', () => {
    expect(mapArticleDetail(article(), SITE).paragraphs).toEqual([]);
  });
});
