import { parseCategories } from '../newsCategories';

/** The endpoint's real shape, names included. */
const PAYLOAD = {
  data: [
    { id: '6837ac247af5dba70a5382e6', name: 'LOCALES', parents: [] },
    { id: '6837acbf7af5dba70a55bc87', name: 'POLICIALES', parents: [] },
    { id: '6837ac257af5dba70a5383c6', name: 'LA REGIÓN', parents: [] },
  ],
};

describe('parseCategories', () => {
  it('keeps the sections in the order the API sends them', () => {
    expect(parseCategories(PAYLOAD).map((c) => c.id)).toEqual([
      '6837ac247af5dba70a5382e6',
      '6837acbf7af5dba70a55bc87',
      '6837ac257af5dba70a5383c6',
    ]);
  });

  // The API shouts: every name comes in capitals. A row of shouting chips reads
  // worse than the station's own site, which writes them normally.
  it.each([
    ['LOCALES', 'Locales'],
    ['POLICIALES', 'Policiales'],
    ['LA REGIÓN', 'La Región'],
    ['NECROLÓGICAS', 'Necrológicas'],
  ])('writes %s as %s', (raw, expected) => {
    expect(parseCategories({ data: [{ id: 'x', name: raw }] })[0]?.name).toBe(expected);
  });

  // A real quirk of this data: one section arrives with a lowercase ó in the
  // middle of a word in capitals. Normalising fixes it for free.
  it('repairs the section the API spells EDUCACIóN', () => {
    expect(parseCategories({ data: [{ id: 'x', name: 'EDUCACIóN' }] })[0]?.name).toBe('Educación');
  });

  it('leaves a name that is already written normally', () => {
    expect(parseCategories({ data: [{ id: 'x', name: '1160 Competición' }] })[0]?.name).toBe(
      '1160 Competición',
    );
  });

  describe('rows that cannot be used', () => {
    it.each([
      ['no id', { name: 'LOCALES' }],
      ['no name', { id: 'x' }],
      ['a blank name', { id: 'x', name: '   ' }],
      ['an id that is not a string', { id: 7, name: 'LOCALES' }],
    ])('drops a row with %s', (_label, row) => {
      expect(parseCategories({ data: [row] })).toEqual([]);
    });

    it('drops only the bad row, never the whole list', () => {
      const parsed = parseCategories({ data: [{ id: 'a', name: 'LOCALES' }, { name: 'ROTA' }] });

      expect(parsed.map((c) => c.id)).toEqual(['a']);
    });

    // The id is what the filter is sent as: two rows sharing one would make the
    // chips ambiguous and the React keys collide.
    it('keeps the first of two rows sharing an id', () => {
      const parsed = parseCategories({
        data: [
          { id: 'a', name: 'LOCALES' },
          { id: 'a', name: 'OTRA' },
        ],
      });

      expect(parsed).toHaveLength(1);
      expect(parsed[0]?.name).toBe('Locales');
    });
  });

  // This list is decoration around the feed. If it cannot be read the chips
  // simply do not appear; the news itself must never depend on it.
  describe('a payload that makes no sense', () => {
    it.each([
      ['null', null],
      ['a string', 'nope'],
      ['an array at the root', [{ id: 'a' }]],
      ['no data key', { other: true }],
      ['a data key that is not an array', { data: 'nope' }],
    ])('returns an empty list for %s', (_label, payload) => {
      expect(parseCategories(payload)).toEqual([]);
    });
  });
});
