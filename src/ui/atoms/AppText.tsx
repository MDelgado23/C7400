import { Text as RNText, StyleSheet, type TextProps } from 'react-native';
import { colors, typography, type TypographyVariant } from '../theme';

interface AppTextProps extends TextProps {
  variant?: TypographyVariant;
  muted?: boolean;
}

/**
 * Themed text atom. Pure/presentational — no logic, just tokens.
 * Every string in the app should render through this so typography stays
 * consistent and a single theme change propagates everywhere.
 */
export function AppText({ variant = 'body', muted, style, ...rest }: AppTextProps) {
  return (
    <RNText
      style={[styles.base, typography[variant], muted && styles.muted, style]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  base: { color: colors.text },
  muted: { color: colors.textMuted },
});
