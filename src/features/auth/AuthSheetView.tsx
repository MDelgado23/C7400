import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '../../ui/atoms/AppText';
import { Spinner } from '../../ui/atoms/Spinner';
import { radius, spacing, useColors, useThemedStyles, type Palette } from '../../ui/theme';
import { copyFor, type AuthMode } from './authSheetState';

interface AuthSheetViewProps {
  mode: AuthMode;
  email: string;
  password: string;
  /** A request is in flight. Blocks submit and shows progress. */
  busy: boolean;
  /** A failure the user needs to act on. */
  errorMessage?: string;
  /** A neutral confirmation — the reset mail, mostly. */
  noticeMessage?: string;
  onChangeEmail: (value: string) => void;
  onChangePassword: (value: string) => void;
  onSubmit: () => void;
  onSelectMode: (mode: AuthMode) => void;
  onDismiss: () => void;
  /** Space below the content — the keyboard or the navigation bar. See `sheetBottomInset`. */
  bottomInset: number;
  /** Whether the password is shown in the clear. */
  revealed: boolean;
  onToggleReveal: () => void;
}

/**
 * Presentational auth sheet. Pure: no service, no navigation — everything
 * arrives via props, so it renders identically in a test and in the app.
 *
 * It opens because the user reached for something an account unlocks, never on
 * launch, and every step keeps a way out. That is not politeness: anonymous-first
 * promises the radio works untouched without an account, and a sheet you cannot
 * close breaks the promise the moment it appears.
 */
export function AuthSheetView({
  mode,
  email,
  password,
  busy,
  errorMessage,
  noticeMessage,
  onChangeEmail,
  onChangePassword,
  onSubmit,
  onSelectMode,
  onDismiss,
  bottomInset,
  revealed,
  onToggleReveal,
}: AuthSheetViewProps) {
  const styles = useThemedStyles(makeStyles);
  const colors = useColors();
  const copy = copyFor(mode);
  const isIntro = mode === 'intro';
  // The label doubles as the accessible name AND the disabled state: pressing it
  // while busy does nothing, so a screen reader must not still be announcing
  // "Crear mi cuenta" on a control that no longer creates anything.
  const submitLabel = busy ? 'Enviando' : copy.submitLabel;
  const feedback = errorMessage ?? noticeMessage;

  return (
    <ScrollView
      style={styles.sheet}
      // The sheet grows only as far as its content: without this it stretches to
      // fill the screen and the backdrop disappears.
      contentContainerStyle={[styles.sheetContent, { paddingBottom: bottomInset }]}
      // With the keyboard up, the first tap on any control would otherwise be
      // swallowed dismissing it — the user presses "Crear mi cuenta", nothing
      // happens, and they press again wondering if the app is broken.
      keyboardShouldPersistTaps="handled"
      bounces={false}
    >
      <View style={styles.grabber} />

      <AppText variant="title">{copy.title}</AppText>
      <AppText variant="body" muted style={styles.body}>
        {copy.body}
      </AppText>

      {copy.showEmail ? (
        <TextInput
          accessibilityLabel="Mail"
          value={email}
          onChangeText={onChangeEmail}
          placeholder="tumail@ejemplo.com"
          placeholderTextColor={colors.textMuted}
          // A capitalized or autocorrected address is one the user is certain
          // they typed correctly and that still will not sign them in.
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          editable={!busy}
          style={styles.input}
        />
      ) : null}

      {copy.showPassword ? (
        // The border lives on the wrapper so the eye sits INSIDE the field
        // rather than floating beside it.
        <View style={styles.passwordField}>
          <TextInput
            accessibilityLabel="Contraseña"
            value={password}
            onChangeText={onChangePassword}
            placeholder="Tu contraseña"
            placeholderTextColor={colors.textMuted}
            secureTextEntry={!revealed}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!busy}
            style={styles.passwordInput}
          />
          {/* A typo in a masked box is invisible until it has already failed —
              and signing in is where that costs most, because the error we
              return deliberately refuses to say which half was wrong. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            onPress={onToggleReveal}
            hitSlop={12}
            style={styles.reveal}
          >
            <Ionicons
              name={revealed ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={colors.textMuted}
            />
          </Pressable>
        </View>
      ) : null}

      {feedback ? (
        // One region for both: a screen reader announcing an error and a
        // confirmation from different places would leave the user hunting for
        // which one just changed.
        <AppText
          accessibilityRole="alert"
          variant="body"
          style={[styles.feedback, errorMessage ? styles.error : styles.notice]}
        >
          {feedback}
        </AppText>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={submitLabel}
        accessibilityState={{ busy }}
        // A double tap on "Crear mi cuenta" is two account creations racing; the
        // loser comes back as email-already-in-use, telling the user their own
        // brand-new account is taken.
        onPress={busy ? undefined : isIntro ? () => onSelectMode('register') : onSubmit}
        style={[styles.primary, busy && styles.primaryBusy]}
      >
        {busy ? (
          <Spinner size={20} thickness={2} color={colors.onPrimary} />
        ) : (
          <AppText variant="subtitle" style={styles.onBrand}>
            {copy.submitLabel}
          </AppText>
        )}
      </Pressable>

      {isIntro ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ya tengo una cuenta"
          onPress={() => onSelectMode('signIn')}
          style={styles.secondary}
        >
          <AppText variant="body" style={styles.link}>
            Ya tengo una cuenta
          </AppText>
        </Pressable>
      ) : null}

      {copy.showForgotPassword ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Olvidé mi contraseña"
          onPress={() => onSelectMode('reset')}
          style={styles.secondary}
        >
          <AppText variant="caption" style={styles.link}>
            Olvidé mi contraseña
          </AppText>
        </Pressable>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isIntro ? 'Ahora no' : 'Volver'}
        onPress={isIntro ? onDismiss : () => onSelectMode('intro')}
        style={styles.secondary}
      >
        <AppText variant="caption" muted>
          {isIntro ? 'Ahora no' : 'Volver'}
        </AppText>
      </Pressable>
    </ScrollView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    // Content sitting ON a brand fill. It does NOT follow `colors.text`, and
    // that is the point of the token: in the dark palette the two happen to be
    // the same white, so the difference is invisible — until the light palette
    // makes `text` near-black and the label disappears into a blue button.
    onBrand: { color: colors.onPrimary },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
      // Caps the sheet on a short screen with the keyboard up: past this it
      // scrolls instead of pushing its own header off the top.
      maxHeight: '90%',
      flexGrow: 0,
    },
    sheetContent: {
      padding: spacing.lg,
      gap: spacing.sm,
    },
    grabber: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: radius.pill,
      backgroundColor: colors.border,
      marginBottom: spacing.sm,
    },
    body: { marginBottom: spacing.sm },
    input: {
      backgroundColor: colors.background,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + spacing.xs,
      color: colors.text,
      fontSize: 16,
    },
    passwordField: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingRight: spacing.xs,
    },
    passwordInput: {
      flex: 1,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + spacing.xs,
      color: colors.text,
      fontSize: 16,
    },
    reveal: { padding: spacing.sm },
    feedback: { marginTop: spacing.xs },
    error: { color: colors.error },
    notice: { color: colors.textMuted },
    primary: {
      backgroundColor: colors.primary,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      alignItems: 'center',
      marginTop: spacing.sm,
      minHeight: 52,
      justifyContent: 'center',
    },
    primaryBusy: { backgroundColor: colors.primaryDark },
    secondary: { alignItems: 'center', paddingVertical: spacing.sm },
    link: { color: colors.primary },
  });
