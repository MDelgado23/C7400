import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '../atoms/AppText';
import { radius, spacing, useColors, useThemedStyles, type Palette } from '../theme';

interface BackgroundPlaybackNoticeProps {
  /** Open the system battery-optimization exemption dialog. */
  onEnable: () => void;
}

/**
 * Presentational warning shown when the app is NOT exempt from battery
 * optimization, so background audio will be cut with the screen off. Pure: the
 * container decides visibility and wires the action. Gives the user the "why"
 * and a one-tap fix instead of letting the stream die unexplained.
 *
 * Intentionally NOT dismissible: the notice stays until the app is actually
 * exempt (verified against the OS, not the dialog), because on some OEMs a
 * single grant lands on "Optimizado" — still not enough for cellular — and a
 * dismissed notice would leave background playback silently broken.
 */
export function BackgroundPlaybackNotice({
  onEnable,
}: BackgroundPlaybackNoticeProps) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.container} accessibilityRole="alert">
      <View style={styles.text}>
        <AppText variant="subtitle">La radio puede cortarse en segundo plano</AppText>
        <AppText variant="caption" muted>
          Para que LU32 siga sonando con la pantalla apagada, permití que la app
          ignore la optimización de batería.
        </AppText>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Activar reproducción en segundo plano"
        onPress={onEnable}
        style={styles.enableButton}
        hitSlop={8}
      >
        <AppText variant="subtitle" style={styles.onBrand}>
          Activar
        </AppText>
      </Pressable>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    // Content sitting ON a brand fill. It does NOT follow `colors.text`, and
    // that is the point of the token: in the dark palette the two happen to be
    // the same white, so the difference is invisible — until the light palette
    // makes `text` near-black and the label disappears into a blue button.
    onBrand: { color: colors.onPrimary },
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
    enableButton: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.pill,
      backgroundColor: colors.primary,
    },
  });
