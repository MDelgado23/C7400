import { useCallback, useState } from 'react';
import { AccountView } from './AccountView';
import { accountSections, type AccountItemId } from './accountMenu';
import { AuthSheet } from '../auth/AuthSheet';
import { useAuthUser } from '../auth/useAuthUser';
import { useThemePreference } from '../../ui/theme';
import { signOut, startAnonymousSession } from '../../core/auth/authService';
import { trackError } from '../../core/observability/observability';
import type { AuthMode } from '../auth/authSheetState';

interface AccountScreenProps {
  /** Opens a settings destination. Only called for rows that are built. */
  onOpenItem: (id: AccountItemId) => void;
}

/**
 * Container for the Cuenta tab.
 *
 * It owns the session actions the rest of the app no longer does: signing in,
 * signing up and signing out all live here now. The saved-articles screen kept
 * only its anonymous prompt — a destructive session action did not belong beside
 * a list of notes.
 */
export function AccountScreen({ onOpenItem }: AccountScreenProps) {
  const user = useAuthUser();
  // Read here rather than inside the menu so the list is still PURE data: the
  // Tema row shows the current choice, and changing it on the picker updates
  // the row behind it without anybody re-fetching anything.
  const theme = useThemePreference();
  const [authVisible, setAuthVisible] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('register');

  const openAuth = useCallback((mode: AuthMode) => {
    setAuthMode(mode);
    setAuthVisible(true);
  }, []);

  const handleSignOut = useCallback(() => {
    void (async () => {
      try {
        await signOut();
      } catch (error) {
        trackError(error, 'account.signOut');
        return;
      }
      // Straight back to an anonymous session. Anonymous-first means the app
      // never sits without an identity: leaving it signed out would make the
      // next "Guardar" fail with nothing on screen explaining why.
      void startAnonymousSession();
    })();
  }, []);

  return (
    <>
      <AccountView
        session={user}
        sections={accountSections(theme)}
        onSelectItem={onOpenItem}
        onSignIn={() => openAuth('signIn')}
        onSignUp={() => openAuth('register')}
        onSignOut={handleSignOut}
      />
      <AuthSheet
        visible={authVisible}
        initialMode={authMode}
        onClose={() => setAuthVisible(false)}
      />
    </>
  );
}
