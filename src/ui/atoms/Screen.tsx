import { StyleSheet, View, type ViewProps } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { spacing, useThemedStyles, type Palette } from '../theme';

interface ScreenProps extends ViewProps {
  /** Apply default screen padding (default: true). */
  padded?: boolean;
  /**
   * Which edges to keep clear of the system bars.
   *
   * The default suits a screen that owns the whole window — a tab with no
   * header. A screen INSIDE a stack that draws a header must drop `top`: the
   * header already sits under the status bar and clears it, so insetting again
   * pushes the content down by a second status bar's worth of nothing. On the
   * test device that was 43dp of dead space below every header — a whole news
   * card's worth, on every screen of the stack.
   */
  edges?: readonly Edge[];
}

/**
 * Screen atom — safe-area aware container with the app background.
 * Bottom edge is intentionally NOT insetted: the persistent mini-player +
 * tab bar own that region, so screens should extend beneath it.
 */
export function Screen({
  padded = true,
  edges = DEFAULT_EDGES,
  style,
  children,
  ...rest
}: ScreenProps) {
  const styles = useThemedStyles(makeStyles);

  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      <View style={[styles.content, padded && styles.padded, style]} {...rest}>
        {children}
      </View>
    </SafeAreaView>
  );
}

const DEFAULT_EDGES = ['top', 'left', 'right'] as const;

/** For a screen inside a stack whose header already clears the status bar. */
export const BELOW_HEADER_EDGES = ['left', 'right'] as const;

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { flex: 1 },
    padded: { padding: spacing.md },
  });
