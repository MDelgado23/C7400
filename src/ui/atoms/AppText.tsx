import { Text as RNText, StyleSheet, type TextProps } from 'react-native';
import { typography, useThemedStyles, type Palette, type TypographyVariant } from '../theme';

interface AppTextProps extends TextProps {
  variant?: TypographyVariant;
  muted?: boolean;
}

/**
 * Themed text atom. Pure/presentational — no logic, just tokens.
 * Every string in the app should render through this so typography stays
 * consistent and a single theme change propagates everywhere.
 *
 * "Propagates everywhere" is now literal rather than aspirational: the colour is
 * read per render from the active palette, so flipping the theme repaints every
 * string in the app without a remount.
 */
export function AppText({ variant = 'body', muted, style, ...rest }: AppTextProps) {
  const styles = useThemedStyles(makeStyles);

  return (
    <RNText
      style={[styles.base, typography[variant], muted && styles.muted, style]}
      {...rest}
    />
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    base: { color: colors.text },
    muted: { color: colors.textMuted },
  });
