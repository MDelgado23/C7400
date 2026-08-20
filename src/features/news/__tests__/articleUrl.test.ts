import { absoluteArticleUrl } from '../articleUrl';

const SITE = 'https://lu32.com.ar';

describe('absoluteArticleUrl', () => {
  // What the API actually sends: a path, not a url, in a field the app has
  // always called `webUrl` and stored under that name in Firestore.
  it('turns the path the API sends into a real url', () => {
    expect(absoluteArticleUrl('/locales/aoma-inicia-medidas-gremiales', SITE)).toBe(
      'https://lu32.com.ar/locales/aoma-inicia-medidas-gremiales',
    );
  });

  it('does not double the slash when the base ends in one', () => {
    expect(absoluteArticleUrl('/deportes/ferro', 'https://lu32.com.ar/')).toBe(
      'https://lu32.com.ar/deportes/ferro',
    );
  });

  it('adds the slash when the path arrives without one', () => {
    expect(absoluteArticleUrl('deportes/ferro', SITE)).toBe('https://lu32.com.ar/deportes/ferro');
  });

  it('leaves an already absolute url alone', () => {
    expect(absoluteArticleUrl('https://lu32.com.ar/policiales/robo', SITE)).toBe(
      'https://lu32.com.ar/policiales/robo',
    );
  });

  describe('nothing to open', () => {
    it.each([
      ['missing', undefined],
      ['empty', ''],
      ['only spaces', '   '],
    ])('returns nothing when the path is %s', (_label, path) => {
      expect(absoluteArticleUrl(path, SITE)).toBeUndefined();
    });

    it('returns nothing when there is no site to build on', () => {
      expect(absoluteArticleUrl('/locales/nota', '')).toBeUndefined();
    });
  });

  // THE SAME BOUNDARY AS THE SPONSORS' LINKS. This value ends up at
  // Linking.openURL, and it comes from an API response that is typed and never
  // validated. The app decides the scheme; a path from the wire never does.
  describe('the app owns the scheme', () => {
    it.each([
      'javascript:alert(1)',
      'intent://evil#Intent;scheme=http;end',
      'http://lu32.com.ar/locales/nota',
      'file:///etc/passwd',
    ])('refuses %s', (hostile) => {
      expect(absoluteArticleUrl(hostile, SITE)).toBeUndefined();
    });

    // A protocol-relative path would resolve against whatever scheme is in
    // play, and a traversal would climb out of the site entirely.
    it.each(['//evil.com/nota', '/../../evil'])('keeps %s on the station host', (path) => {
      const url = absoluteArticleUrl(path, SITE);

      if (url !== undefined) expect(new URL(url).host).toBe('lu32.com.ar');
    });

    it('never returns anything that is not https', () => {
      for (const path of ['/locales/x', 'deportes/y', 'https://lu32.com.ar/z']) {
        const url = absoluteArticleUrl(path, SITE);
        if (url !== undefined) expect(url.startsWith('https://')).toBe(true);
      }
    });
  });
});
