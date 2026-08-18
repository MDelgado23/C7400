import { StyleSheet, View, type ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme';

interface ScreenProps extends ViewProps {
  /** Apply default screen padding (default: true). */
  padded?: boolean;
}

/**
 * Screen atom — safe-area aware container with the app background.
 * Bottom edge is intentionally NOT insetted: the persistent mini-player +
 * tab bar own that region, so screens should extend beneath it.
 */
export function Screen({ padded = true, style, children, ...rest }: ScreenProps) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={[styles.content, padded && styles.padded, style]} {...rest}>
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1 },
  padded: { padding: spacing.md },
});
