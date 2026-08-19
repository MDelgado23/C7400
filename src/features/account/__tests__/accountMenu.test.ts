import { accountSections, accountTabLabel, type AccountItem } from '../accountMenu';

const allItems = (): AccountItem[] => accountSections().flatMap((section) => section.items);

describe('accountTabLabel', () => {
  it('says Entrar to someone without an account', () => {
    // The tab IS the call to action for an anonymous user. "Cuenta" would be
    // naming something they do not have yet.
    expect(accountTabLabel({ isAnonymous: true })).toBe('Entrar');
  });

  it('says Cuenta once they have one', () => {
    expect(accountTabLabel({ isAnonymous: false })).toBe('Cuenta');
  });

  it('says Entrar while the session is still unknown', () => {
    // At boot, before auth reports. The label has to say something, and the tab
    // flipping from "Cuenta" to "Entrar" a moment later would look like a
    // glitch — this way it only ever settles in one direction.
    expect(accountTabLabel(null)).toBe('Entrar');
  });
});

describe('accountSections', () => {
  it('groups the settings under headings', () => {
    expect(accountSections().map((section) => section.title)).toEqual([
      'Seguridad',
      'Notas',
      'Visual',
    ]);
  });

  it('gives every item a label', () => {
    // Exhaustive by construction: an item added without one fails here rather
    // than rendering a blank row with a chevron.
    for (const item of allItems()) {
      expect(item.label.trim().length).toBeGreaterThan(0);
    }
  });

  it('has no duplicate ids', () => {
    // The id is what the container switches on. Two rows sharing one would send
    // the user somewhere they did not tap.
    const ids = allItems().map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('marks the saved-articles row as usable, because it is built', () => {
    const saved = allItems().find((item) => item.id === 'saved-articles');
    expect(saved?.available).toBe(true);
  });

  it.each(['theme'])('marks %s as not built yet', (id) => {
    // Declared but inert. A row that looks tappable and does nothing is worse
    // than one that says plainly it is not ready.
    expect(allItems().find((item) => item.id === id)?.available).toBe(false);
  });

  it('puts the saved notes under their own heading, not under security', () => {
    const notes = accountSections().find((section) => section.title === 'Notas');
    expect(notes?.items.map((item) => item.id)).toEqual(['saved-articles']);
  });
});
