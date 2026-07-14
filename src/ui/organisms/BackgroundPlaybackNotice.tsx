import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '../atoms/AppText';
import { colors, radius, spacing } from '../theme';

interface BackgroundPlaybackNoticeProps {
  /** Open the system battery-optimization exemption dialog. */
  onEnable: () => void;
  /** Hide the notice for this session. */
  onDismiss: () => void;
}

/**
 * Presentational warning shown when the app is NOT exempt from battery
 * optimization, so background audio will be cut with the screen off. Pure: the
 * container decides visibility and wires the actions. Gives the user the "why"
 * and a one-tap fix instead of letting the stream die unexplained.
 */
export function BackgroundPlaybackNotice({
  onEnable,
  onDismiss,
}: BackgroundPlaybackNoticeProps) {
  return (
    <View style={styles.container} accessibilityRole="alert">
      <View style={styles.text}>
        <AppText variant="subtitle">La radio puede cortarse en segundo plano</AppText>
        <AppText variant="caption" muted>
          Para que LU32 siga sonando con la pantalla apagada, permití que la app
          ignore la optimización de batería.
        </AppText>
      </View>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Activar reproducción en segundo plano"
          onPress={onEnable}
          style={styles.enableButton}
          hitSlop={8}
        >
          <AppText variant="subtitle">Activar</AppText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Descartar aviso"
          onPress={onDismiss}
          style={styles.dismissButton}
          hitSlop={12}
        >
          <AppText variant="subtitle" muted>
            ✕
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  text: { flex: 1, gap: spacing.xs },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  enableButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  dismissButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
