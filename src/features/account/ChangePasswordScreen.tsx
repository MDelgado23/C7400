import { useCallback, useState } from 'react';
import { ChangePasswordView } from './ChangePasswordView';
import { changePassword } from '../../core/auth/authService';
import { messageFor, toAuthError } from '../../core/auth/authErrors';

/**
 * Container for the change-password form.
 *
 * On success it CLEARS both fields and stays on the screen. Navigating away
 * would be the only signal anything happened, and "the screen closed" is
 * indistinguishable from "I tapped back by accident" — so the confirmation is
 * spoken instead.
 */
export function ChangePasswordScreen() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const [noticeMessage, setNoticeMessage] = useState<string | undefined>(undefined);

  const handleSubmit = useCallback(async () => {
    setBusy(true);
    setErrorMessage(undefined);
    setNoticeMessage(undefined);
    try {
      await changePassword(currentPassword, newPassword);
      // Cleared on success only. Leaving them filled invites a second submit
      // that would now fail, since the "current" password in the box is the old
      // one — and that failure would read as the change not having worked.
      setCurrentPassword('');
      setNewPassword('');
      setRevealed(false);
      setNoticeMessage('Listo, cambiaste la contraseña.');
    } catch (error) {
      setErrorMessage(messageFor(toAuthError(error).code));
    } finally {
      setBusy(false);
    }
  }, [currentPassword, newPassword]);

  return (
    <ChangePasswordView
      currentPassword={currentPassword}
      newPassword={newPassword}
      revealed={revealed}
      busy={busy}
      errorMessage={errorMessage}
      noticeMessage={noticeMessage}
      onChangeCurrent={(value) => {
        setCurrentPassword(value);
        // A message about the previous attempt, sitting over freshly typed
        // input, reads as a verdict on what is being typed now.
        setErrorMessage(undefined);
        setNoticeMessage(undefined);
      }}
      onChangeNext={(value) => {
        setNewPassword(value);
        setErrorMessage(undefined);
        setNoticeMessage(undefined);
      }}
      onToggleReveal={() => setRevealed((shown) => !shown)}
      onSubmit={handleSubmit}
    />
  );
}
