import { parseSponsors } from '../sponsor';

/** A well-formed document entry; overrides let each test break ONE thing. */
function raw(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'fravega',
    pos: 1,
    name: 'Frávega',
    logoUrl: 'https://cdn.lu32.com.ar/sponsors/fravega.png',
    description: 'Electrodomésticos y tecnología',
    website: 'https://www.fravega.com',
    instagram: 'fravega',
    facebook: 'fravega',
    whatsapp: '+54 9 3764 123456',
    phone: '+54 9 3764 123456',
    address: 'Av. Mitre 1234, Oberá',
    ...overrides,
  };
}

function doc(sponsors: unknown[]): unknown {
  return { sponsors };
}

describe('parseSponsors', () => {
  it('keeps a well-formed sponsor with every field', () => {
    const [sponsor] = parseSponsors(doc([raw()]));

    expect(sponsor).toEqual({
      id: 'fravega',
      name: 'Frávega',
      logoUrl: 'https://cdn.lu32.com.ar/sponsors/fravega.png',
      description: 'Electrodomésticos y tecnología',
      website: 'https://www.fravega.com',
      instagram: 'fravega',
      facebook: 'fravega',
      whatsapp: '+54 9 3764 123456',
      phone: '+54 9 3764 123456',
      address: 'Av. Mitre 1234, Oberá',
    });
  });

  describe('ordering', () => {
    // `pos` exists so the document SAYS who goes where, instead of the answer
    // being "count the array". GAPS ARE THE POINT: numbering 10/20/30 makes
    // inserting someone between the second and third a single edit (25) rather
    // than a renumbering of everyone below them.
    it('sorts by pos, not by the order entries happen to be written in', () => {
      const ids = parseSponsors(
        doc([
          raw({ id: 'tercero', pos: 30 }),
          raw({ id: 'primero', pos: 10 }),
          raw({ id: 'segundo', pos: 20 }),
        ]),
      ).map((s) => s.id);

      expect(ids).toEqual(['primero', 'segundo', 'tercero']);
    });

    // Two sources of ordering that can disagree is the same trap as a null with
    // two meanings. The parser consumes pos and hands back a list whose ORDER is
    // the order; nothing downstream gets a second opinion to go by.
    it('never exposes pos — after parsing, the array order IS the order', () => {
      const [sponsor] = parseSponsors(doc([raw({ pos: 7 })]));

      expect(sponsor).not.toHaveProperty('pos');
    });

    it('breaks a tie on document order, so a duplicate pos is not a coin flip', () => {
      const ids = parseSponsors(
        doc([raw({ id: 'escrito-antes', pos: 3 }), raw({ id: 'escrito-despues', pos: 3 })]),
      ).map((s) => s.id);

      expect(ids).toEqual(['escrito-antes', 'escrito-despues']);
    });

    // Nobody placed them, so they do not get to jump ahead of the ones somebody did.
    it('sends sponsors with no pos to the end, in document order', () => {
      const ids = parseSponsors(
        doc([
          raw({ id: 'sin-pos-a', pos: undefined }),
          raw({ id: 'numerado', pos: 99 }),
          raw({ id: 'sin-pos-b', pos: undefined }),
        ]),
      ).map((s) => s.id);

      expect(ids).toEqual(['numerado', 'sin-pos-a', 'sin-pos-b']);
    });

    it.each([
      ['a string', '3'],
      ['null', null],
      ['NaN', NaN],
      ['Infinity', Infinity],
    ])('treats a pos that is %s as absent', (_label, pos) => {
      const ids = parseSponsors(
        doc([raw({ id: 'invalido', pos }), raw({ id: 'valido', pos: 50 })]),
      ).map((s) => s.id);

      expect(ids).toEqual(['valido', 'invalido']);
    });

    it('falls back to document order when no sponsor carries a pos', () => {
      const ids = parseSponsors(
        doc([
          raw({ id: 'primero', pos: undefined }),
          raw({ id: 'segundo', pos: undefined }),
          raw({ id: 'tercero', pos: undefined }),
        ]),
      ).map((s) => s.id);

      expect(ids).toEqual(['primero', 'segundo', 'tercero']);
    });
  });

  describe('required fields', () => {
    // Without one of these there is nothing to render and nothing to track, so
    // the entry is dropped ENTIRELY rather than shown as a broken tile.
    it.each(['id', 'name', 'logoUrl'])('drops a sponsor with no %s', (field) => {
      expect(parseSponsors(doc([raw({ [field]: undefined })]))).toEqual([]);
    });

    it.each(['id', 'name', 'logoUrl'])('drops a sponsor whose %s is blank', (field) => {
      expect(parseSponsors(doc([raw({ [field]: '   ' })]))).toEqual([]);
    });

    it.each(['id', 'name', 'logoUrl'])('drops a sponsor whose %s is not a string', (field) => {
      expect(parseSponsors(doc([raw({ [field]: 42 })]))).toEqual([]);
    });

    it('drops only the malformed entry, never the whole list', () => {
      const ids = parseSponsors(doc([raw({ id: 'bueno' }), raw({ name: '' })])).map((s) => s.id);

      expect(ids).toEqual(['bueno']);
    });
  });

  describe('logoUrl', () => {
    // The logo is fed straight to <Image>. http:// is blocked by ATS on iOS and
    // by cleartext policy on Android, so it would render as an empty box.
    it.each(['http://cdn/logo.png', '//cdn/logo.png', 'cdn/logo.png', 'javascript:alert(1)'])(
      'drops a sponsor whose logoUrl is %s',
      (logoUrl) => {
        expect(parseSponsors(doc([raw({ logoUrl })]))).toEqual([]);
      },
    );
  });

  describe('optional fields', () => {
    it('omits the ones that are absent instead of carrying undefined keys', () => {
      const [sponsor] = parseSponsors(
        doc([{ id: 'x', name: 'X', logoUrl: 'https://cdn/x.png' }]),
      );

      expect(sponsor).toEqual({ id: 'x', name: 'X', logoUrl: 'https://cdn/x.png' });
    });

    it('drops a blank or non-string optional field but keeps the sponsor', () => {
      const [sponsor] = parseSponsors(doc([raw({ instagram: '  ', phone: 99 })]));

      expect(sponsor).toMatchObject({ id: 'fravega' });
      expect(sponsor).not.toHaveProperty('instagram');
      expect(sponsor).not.toHaveProperty('phone');
    });

    // website is the ONE field that is a URL rather than a handle, so it gets
    // the same https-only rule as the logo. See buildSponsorLinks.
    it.each(['http://fravega.com', 'javascript:alert(1)', 'fravega.com'])(
      'drops website %s but keeps the sponsor',
      (website) => {
        const [sponsor] = parseSponsors(doc([raw({ website })]));

        expect(sponsor).toMatchObject({ id: 'fravega' });
        expect(sponsor).not.toHaveProperty('website');
      },
    );
  });

  describe('hygiene', () => {
    it('trims surrounding whitespace', () => {
      const [sponsor] = parseSponsors(doc([raw({ id: '  fravega  ', name: ' Frávega ' })]));

      expect(sponsor).toMatchObject({ id: 'fravega', name: 'Frávega' });
    });

    it('ignores keys the app does not know about', () => {
      const [sponsor] = parseSponsors(doc([raw({ tier: 'gold', __proto__: 'nope' })]));

      expect(sponsor).not.toHaveProperty('tier');
    });

    // The id is BOTH the React list key and the analytics dimension: a duplicate
    // would warn on every render and silently merge two sponsors' tap counts.
    it('keeps the first of two sponsors sharing an id', () => {
      const parsed = parseSponsors(doc([raw({ name: 'Primero' }), raw({ name: 'Segundo' })]));

      expect(parsed).toHaveLength(1);
      expect(parsed[0]).toMatchObject({ name: 'Primero' });
    });
  });

  describe('malformed documents', () => {
    // This document is fetched from a public repo. It must never throw: the
    // screen degrades to "no hay auspiciantes", it does not take the app down.
    it.each([
      ['null', null],
      ['undefined', undefined],
      ['a string', 'nope'],
      ['a number', 7],
      ['an array at the root', [{ id: 'x' }]],
      ['an object with no sponsors key', { other: true }],
      ['a sponsors key that is not an array', { sponsors: 'nope' }],
    ])('returns an empty list for %s', (_label, input) => {
      expect(parseSponsors(input)).toEqual([]);
    });

    it('skips entries that are not objects', () => {
      const ids = parseSponsors(doc([null, 'nope', 7, [], raw({ id: 'sobrevive' })])).map(
        (s) => s.id,
      );

      expect(ids).toEqual(['sobrevive']);
    });
  });
});
