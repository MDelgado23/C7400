import { accountSections, accountTabLabel, type AccountItem } from '../accountMenu';
import type { ThemePreference } from '../../../core/theme/themePreference';

const sections = (theme: ThemePreference = 'dark') => accountSections(theme);

const allItems = (theme: ThemePreference = 'dark'): AccountItem[] =>
  sections(theme).flatMap((section) => section.items);

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
    expect(sections().map((section) => section.title)).toEqual([
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

  it('marks the theme row as usable, now that there is somewhere to go', () => {
    expect(allItems().find((item) => item.id === 'theme')?.available).toBe(true);
  });

  it('leaves no row inert, now that every destination exists', () => {
    // The inverse of the check this replaced, which listed the unbuilt rows.
    // When the next one lands, THIS is the test that has to be narrowed back
    // down — deliberately, rather than a stale allowlist quietly passing.
    for (const item of allItems()) {
      expect(`${item.id}: ${item.available}`).toBe(`${item.id}: true`);
    }
  });

  it('shows the chosen theme on the row, so the value is visible without opening it', () => {
    // A settings row whose current value is only discoverable by tapping it is
    // a settings row that makes you tap everything to find what you changed.
    expect(allItems('light').find((item) => item.id === 'theme')?.detail).toBe('Claro');
    expect(allItems('system').find((item) => item.id === 'theme')?.detail).toBe('Automático');
    expect(allItems('dark').find((item) => item.id === 'theme')?.detail).toBe('Oscuro');
  });

  it('puts the saved notes under their own heading, not under security', () => {
    const notes = sections().find((section) => section.title === 'Notas');
    expect(notes?.items.map((item) => item.id)).toEqual(['saved-articles']);
  });
});
