import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthSheetView } from './AuthSheetView';
import { submitActionFor, type AuthMode } from './authSheetState';
import { sheetBottomInset } from './sheetInsets';
import { useKeyboardHeight } from './useKeyboardHeight';
import { useAuthUser } from './useAuthUser';
import {
  registerWithEmail,
  signInWithEmail,
  upgradeToEmailAccount,
  sendPasswordReset,
} from '../../core/auth/authService';
import { messageFor, toAuthError } from '../../core/auth/authErrors';

interface AuthSheetProps {
  visible: boolean;
  onClose: () => void;
  /**
   * Which step to open on. Defaults to the pitch, which is right when the sheet
   * appears uninvited after a save. Callers that have already made the case —
   * the account row on the saved list — send the user straight to the form they
   * asked for.
   */
  initialMode?: AuthMode;
}

/**
 * The auth sheet's container: the only place the auth port and the auth UI meet.
 *
 * Opened CONTEXTUALLY — from the moment a user reaches for something an account
 * unlocks — and never at launch. That is the whole navigation decision behind
 * anonymous-first: on a radio app, most people press play and pocket the phone,
 * and a login wall at the door costs listeners while buying nothing.
 */
export function AuthSheet({ visible, onClose, initialMode = 'intro' }: AuthSheetProps) {
  const user = useAuthUser();
  const keyboardHeight = useKeyboardHeight();
  const safeArea = useSafeAreaInsets();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const [noticeMessage, setNoticeMessage] = useState<string | undefined>(undefined);

  /**
   * A fresh sheet on every opening.
   *
   * This state lives ABOVE the Modal and therefore outlives it. Without the
   * reset, closing the sheet mid-registration and opening it again hands the
   * next person the previous one's typed password, still in the field — on a
   * phone that gets passed around, that is not just untidy.
   */
  useEffect(() => {
    if (!visible) return;
    setMode(initialMode);
    setEmail('');
    setPassword('');
    setRevealed(false);
    setErrorMessage(undefined);
    setNoticeMessage(undefined);
  }, [visible, initialMode]);

  /**
   * Moving between steps clears both messages. An error about a password, left
   * standing over a form that no longer asks for one, reads as a fresh failure
   * of something the user has not even tried yet.
   */
  const handleSelectMode = useCallback((next: AuthMode) => {
    setMode(next);
    // Re-masked on every step. Leaving a password on screen while the user is
    // navigating elsewhere protects nobody, and the field they land on is a
    // different one anyway.
    setRevealed(false);
    setErrorMessage(undefined);
    setNoticeMessage(undefined);
  }, []);

  const handleSubmit = useCallback(async () => {
    // `isAnonymous` decides whether registering PROMOTES this session or starts
    // a new one. Getting it wrong abandons everything the user already saved.
    const action = submitActionFor(mode, user?.isAnonymous ?? false);
    if (action === null) return;

    setBusy(true);
    setErrorMessage(undefined);
    setNoticeMessage(undefined);
    try {
      switch (action) {
        case 'upgrade':
          await upgradeToEmailAccount(email, password);
          break;
        case 'register':
          await registerWithEmail(email, password);
          break;
        case 'signIn':
          await signInWithEmail(email, password);
          break;
        case 'reset':
          await sendPasswordReset(email);
          // Stays open on purpose: this notice is the ONLY signal the user gets
          // that anything happened, and closing over it invites them to send the
          // mail again and again. It also says nothing about whether the address
          // is registered — the same enumeration oracle the port closes.
          setNoticeMessage('Si el mail está registrado, ya te mandamos el enlace.');
          return;
      }
      onClose();
    } catch (error) {
      // Our sentence, not the provider's. `toAuthError` is idempotent, so a
      // failure raised outside the port still arrives as a code with a message
      // rather than as a blank alert.
      setErrorMessage(messageFor(toAuthError(error).code));
    } finally {
      setBusy(false);
    }
  }, [mode, user, email, password, onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      // The hardware back button is a way out on Android, same as "Ahora no".
      onRequestClose={onClose}
      // The app draws edge-to-edge, so without these the dimmed backdrop stops
      // short of the system bars and the sheet sits on a strip of bare screen.
      // The bars are then cleared by `bottomInset` instead — see `sheetInsets`.
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View style={styles.backdrop}>
        {/* Tapping the dimmed area closes it — the gesture every sheet has. */}
        <Pressable
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.dismissArea}
          onPress={onClose}
        />
        {/*
          No KeyboardAvoidingView: on Android this Modal is its own Dialog
          window and never receives the activity's adjustResize, so it had
          nothing to react to and the keyboard simply covered the form. The lift
          is measured and applied directly instead.
        */}
        <AuthSheetView
          mode={mode}
          email={email}
          password={password}
          busy={busy}
          errorMessage={errorMessage}
          noticeMessage={noticeMessage}
          onChangeEmail={setEmail}
          onChangePassword={setPassword}
          onSubmit={handleSubmit}
          onSelectMode={handleSelectMode}
          onDismiss={onClose}
          revealed={revealed}
          onToggleReveal={() => setRevealed((shown) => !shown)}
          bottomInset={sheetBottomInset({
            keyboardHeight,
            safeAreaBottom: safeArea.bottom,
          })}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  dismissArea: { flex: 1 },
});
