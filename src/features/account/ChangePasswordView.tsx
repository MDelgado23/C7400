import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../ui/atoms/Screen';
import { AppText } from '../../ui/atoms/AppText';
import { Spinner } from '../../ui/atoms/Spinner';
import { colors, radius, spacing } from '../../ui/theme';
import { MIN_PASSWORD_LENGTH } from '../../core/auth/credentials';

interface ChangePasswordViewProps {
  currentPassword: string;
  newPassword: string;
  /** Whether the NEW password is shown in the clear. */
  revealed: boolean;
  busy: boolean;
  errorMessage?: string;
  noticeMessage?: string;
  onChangeCurrent: (value: string) => void;
  onChangeNext: (value: string) => void;
  onToggleReveal: () => void;
  onSubmit: () => void;
}

/**
 * Presentational change-password form. Pure: no service, no navigation.
 *
 * It asks for the CURRENT password, and that is a security requirement rather
 * than a formality — without it, anybody holding an unlocked phone changes the
 * password and locks the owner out of their own account.
 *
 * There is no "repeat the new password" field. A typo in a masked box would lock
 * the user out until they went through an email reset, so instead they can SEE
 * what they typed: one control, same protection, one less field.
 */
export function ChangePasswordView({
  currentPassword,
  newPassword,
  revealed,
  busy,
  errorMessage,
  noticeMessage,
  onChangeCurrent,
  onChangeNext,
  onToggleReveal,
  onSubmit,
}: ChangePasswordViewProps) {
  // The label doubles as the accessible name AND the disabled state, so a screen
  // reader never announces "Cambiar contraseña" on a control that is mid-flight.
  const submitLabel = busy ? 'Guardando' : 'Cambiar contraseña';
  const feedback = errorMessage ?? noticeMessage;

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <AppText variant="body" muted>
          Vas a necesitar tu contraseña actual. Es lo que evita que alguien con tu celular
          desbloqueado te cambie la clave.
        </AppText>

        <View style={styles.field}>
          <AppText variant="caption" muted>
            Contraseña actual
          </AppText>
          <TextInput
            accessibilityLabel="Contraseña actual"
            value={currentPassword}
            onChangeText={onChangeCurrent}
            // Never revealed: whoever is typing it already knows it, so showing
            // it adds nothing and puts an existing secret on screen for anyone
            // standing nearby.
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            editable={!busy}
            style={styles.input}
          />
        </View>

        <View style={styles.field}>
          <View style={styles.fieldHeader}>
            <AppText variant="caption" muted>
              Contraseña nueva
            </AppText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={revealed ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              onPress={onToggleReveal}
              hitSlop={12}
              style={styles.reveal}
            >
              <Ionicons
                name={revealed ? 'eye-off-outline' : 'eye-outline'}
                size={18}
                color={colors.primary}
              />
            </Pressable>
          </View>
          <TextInput
            accessibilityLabel="Contraseña nueva"
            value={newPassword}
            onChangeText={onChangeNext}
            secureTextEntry={!revealed}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!busy}
            style={styles.input}
          />
          {/* Stated up front. A rule the user only discovers by breaking it is a
              rule stated too late. */}
          <AppText variant="caption" muted>
            Al menos {MIN_PASSWORD_LENGTH} caracteres.
          </AppText>
        </View>

        {feedback ? (
          <AppText
            accessibilityRole="alert"
            variant="body"
            style={errorMessage ? styles.error : styles.notice}
          >
            {feedback}
          </AppText>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={submitLabel}
          accessibilityState={{ busy }}
          onPress={busy ? undefined : onSubmit}
          disabled={busy}
          style={[styles.submit, busy && styles.submitBusy]}
        >
          {busy ? (
            <Spinner size={20} thickness={2} color={colors.text} />
          ) : (
            <AppText variant="subtitle">Cambiar contraseña</AppText>
          )}
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.md },
  field: { gap: spacing.xs },
  fieldHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reveal: { padding: spacing.xs },
  input: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + spacing.xs,
    color: colors.text,
    fontSize: 16,
  },
  error: { color: colors.error },
  notice: { color: colors.primary },
  submit: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    marginTop: spacing.sm,
  },
  submitBusy: { backgroundColor: colors.primaryDark },
});
