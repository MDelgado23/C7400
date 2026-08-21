/**
 * The Cuenta tab's structure — PURE.
 *
 * Kept out of the component so the shape of the settings is something we can
 * assert on. Two things it guarantees that a hand-built JSX list would not: that
 * every row has a label, and that no two rows share an id — the id is what the
 * container switches on, so a duplicate would send someone somewhere they did
 * not tap.
 */

import {
  themePreferenceLabel,
  type ThemePreference,
} from '../../core/theme/themePreference';

export type AccountItemId = 'change-password' | 'saved-articles' | 'theme';

export interface AccountItem {
  id: AccountItemId;
  label: string;
  /** Current value, shown on the right. */
  detail?: string;
  /**
   * Whether the destination exists yet. Rows that are not built render visibly
   * inert: one that looks tappable and does nothing is worse than one that says
   * plainly it is not ready.
   */
  available: boolean;
}

export interface AccountSection {
  title: string;
  items: AccountItem[];
}

/**
 * PURE. What to show inside the Cuenta tab for a signed-in user.
 *
 * A function rather than a constant so it can take the current theme, locale and
 * so on as those arrive, without every call site changing shape. The theme was
 * the first of those to arrive, and it slotted in exactly as intended.
 */
export function accountSections(theme: ThemePreference): AccountSection[] {
  return [
    {
      title: 'Seguridad',
      items: [{ id: 'change-password', label: 'Cambiar contraseña', available: true }],
    },
    {
      title: 'Notas',
      items: [{ id: 'saved-articles', label: 'Notas guardadas', available: true }],
    },
    {
      title: 'Visual',
      // The current value on the row, not just the name of the setting. A
      // settings list whose values are only discoverable by opening each row is
      // one you have to tap through to find what you changed.
      items: [
        {
          id: 'theme',
          label: 'Tema',
          detail: themePreferenceLabel(theme),
          available: true,
        },
      ],
    },
  ];
}

/**
 * PURE. The tab's label.
 *
 * For an anonymous user the tab IS the call to action, so it says what it does.
 * "Cuenta" would be naming something they do not have.
 *
 * An unknown session gets "Entrar" too. The label has to say something before
 * auth reports, and settling from "Entrar" to "Cuenta" reads as the app learning
 * who you are; the other direction reads as a glitch.
 */
export function accountTabLabel(session: { isAnonymous: boolean } | null): string {
  return session !== null && !session.isAnonymous ? 'Cuenta' : 'Entrar';
}
