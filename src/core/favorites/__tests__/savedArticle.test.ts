import {
  toSavedArticle,
  fromStoredData,
  MAX_BODY_CHARS,
  type SavedArticle,
} from '../savedArticle';
import type { ArticleDetail } from '../../../features/news/newsMapping';

function article(overrides: Partial<ArticleDetail> = {}): ArticleDetail {
  return {
    id: 'a-1',
    title: 'Se viene el temporal',
    summary: 'Alerta amarilla para toda la zona.',
    kicker: 'Clima',
    imageUrl: 'https://cdn/hero.jpg',
    thumbUrl: 'https://cdn/thumb.jpg',
    publishedAt: '2026-08-19T10:00:00Z',
    webUrl: 'https://lu32.com.ar/nota/a-1',
    paragraphs: ['Primer párrafo.', 'Segundo párrafo.'],
    ...overrides,
  };
}

describe('toSavedArticle', () => {
  it('carries the whole article across, body included', async () => {
    const saved = toSavedArticle(article(), 1_700_000_000_000);

    expect(saved).toEqual({
      id: 'a-1',
      title: 'Se viene el temporal',
      summary: 'Alerta amarilla para toda la zona.',
      kicker: 'Clima',
      imageUrl: 'https://cdn/hero.jpg',
      thumbUrl: 'https://cdn/thumb.jpg',
      publishedAt: '2026-08-19T10:00:00Z',
      webUrl: 'https://lu32.com.ar/nota/a-1',
      paragraphs: ['Primer párrafo.', 'Segundo párrafo.'],
      savedAt: 1_700_000_000_000,
    });
  });

  it('OMITS absent optional fields instead of setting them to undefined', () => {
    // Firestore rejects a document containing an `undefined` value outright:
    // "Unsupported field value: undefined". A single article with no kicker
    // would fail the whole save with an error about a field the user never saw.
    const saved = toSavedArticle(
      article({ kicker: undefined, imageUrl: undefined, webUrl: undefined }),
      1,
    );

    expect(Object.keys(saved)).not.toContain('kicker');
    expect(Object.keys(saved)).not.toContain('imageUrl');
    expect(Object.keys(saved)).not.toContain('webUrl');
    expect('thumbUrl' in saved).toBe(true);
  });

  it('records the client clock, not a server sentinel', () => {
    // A server timestamp reads back as null from the local cache until the write
    // reaches Firebase. Offline — which is exactly when saving for later
    // matters — the list would sort on nulls the moment it is written. Clock
    // skew between two devices can misorder a "recién guardadas" list by a few
    // minutes; a null cannot be ordered at all.
    const saved = toSavedArticle(article(), 1_700_000_000_000);

    expect(saved.savedAt).toBe(1_700_000_000_000);
    expect(typeof saved.savedAt).toBe('number');
  });

  it('keeps a normal article whole', () => {
    const saved = toSavedArticle(article(), 1);

    expect(saved.paragraphs).toHaveLength(2);
    expect('truncated' in saved).toBe(false);
  });
});

describe('oversized bodies', () => {
  function hugeArticle(): ArticleDetail {
    const paragraph = 'a'.repeat(10_000);
    const count = Math.ceil(MAX_BODY_CHARS / paragraph.length) + 5;
    return article({ paragraphs: Array.from({ length: count }, () => paragraph) });
  }

  it('drops trailing paragraphs rather than failing the save', () => {
    // Firestore caps a document at 1 MiB and REJECTS anything over it. Losing
    // the save entirely — for an article the user explicitly asked to keep —
    // is worse than keeping most of it.
    const saved = toSavedArticle(hugeArticle(), 1);

    const size = saved.paragraphs.join('').length;
    expect(size).toBeLessThanOrEqual(MAX_BODY_CHARS);
    expect(saved.paragraphs.length).toBeGreaterThan(0);
  });

  it('cuts on paragraph boundaries, never mid-sentence', () => {
    const saved = toSavedArticle(hugeArticle(), 1);

    for (const paragraph of saved.paragraphs) {
      expect(paragraph).toBe('a'.repeat(10_000));
    }
  });

  it('says so, instead of losing text silently', () => {
    // The flag is what lets the reader be told the note is cut and offered the
    // web version. Silent truncation is the invisible failure this codebase
    // exists to avoid.
    expect(toSavedArticle(hugeArticle(), 1).truncated).toBe(true);
  });
});

describe('fromStoredData', () => {
  function stored(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return { ...toSavedArticle(article(), 1_700_000_000_000), ...overrides };
  }

  it('reads back what was written', () => {
    expect(fromStoredData(stored())).toEqual(toSavedArticle(article(), 1_700_000_000_000));
  });

  it.each([
    ['missing id', { id: undefined }],
    ['missing title', { title: undefined }],
    ['id of the wrong type', { id: 42 }],
    ['title of the wrong type', { title: null }],
  ])('rejects a document with a %s', (_label, overrides) => {
    // Stored documents are just JSON: an older app version, a half-finished
    // write or a hand edit in the console can all produce one that no longer
    // matches this shape. Dropping the bad row beats crashing the whole list.
    expect(fromStoredData(stored(overrides))).toBeNull();
  });

  it('rejects a value that is not an object at all', () => {
    expect(fromStoredData(null)).toBeNull();
    expect(fromStoredData('nope')).toBeNull();
  });

  it('repairs a document with no body rather than dropping it', () => {
    // The title and the link still make it a usable saved article; refusing it
    // would delete something the user chose to keep over a missing field.
    const recovered = fromStoredData(stored({ paragraphs: undefined }));

    expect(recovered?.paragraphs).toEqual([]);
    expect(recovered?.title).toBe('Se viene el temporal');
  });

  it('repairs a document with no timestamp so it can still be ordered', () => {
    const recovered = fromStoredData(stored({ savedAt: 'ayer' }));

    expect(typeof recovered?.savedAt).toBe('number');
  });

  it('drops optional fields that came back the wrong type', () => {
    const recovered = fromStoredData(stored({ kicker: 99 }));

    expect(recovered).not.toBeNull();
    expect('kicker' in (recovered as SavedArticle)).toBe(false);
  });
});

// Notes saved before the mapper learned to build absolute addresses carry the
// PATH the API sends under a field named `webUrl`. Those rows are already in
// Firestore, and a link that opens nothing is worse than no link at all.
describe('fromStoredData and the legacy webUrl', () => {
  const stored = {
    id: 'a',
    title: 'Una nota',
    summary: '',
    publishedAt: '2026-08-20T10:00:00.000Z',
    paragraphs: [],
    savedAt: 1,
  };

  it('keeps an absolute https address', () => {
    const recovered = fromStoredData({ ...stored, webUrl: 'https://lu32.com.ar/locales/nota' });

    expect(recovered?.webUrl).toBe('https://lu32.com.ar/locales/nota');
  });

  it.each([
    ['a bare path', '/locales/aoma-inicia-medidas-gremiales'],
    ['an http address', 'http://lu32.com.ar/locales/nota'],
    ['a scheme', 'javascript:alert(1)'],
  ])('drops %s, keeping the rest of the note', (_label, webUrl) => {
    const recovered = fromStoredData({ ...stored, webUrl });

    expect(recovered).toMatchObject({ id: 'a', title: 'Una nota' });
    expect(recovered?.webUrl).toBeUndefined();
  });
});
