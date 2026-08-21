import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BELOW_HEADER_EDGES, Screen } from '../../ui/atoms/Screen';
import { AppText } from '../../ui/atoms/AppText';
import { radius, spacing, useColors, useThemedStyles, type Palette } from '../../ui/theme';
import {
  THEME_PREFERENCE_OPTIONS,
  themePreferenceLabel,
  type ThemePreference,
} from '../../core/theme/themePreference';

interface ThemeViewProps {
  /** The choice currently stored. Drives which row is marked. */
  preference: ThemePreference;
  onSelect: (preference: ThemePreference) => void;
}

/**
 * What each option means, for the ones where the name is not the whole story.
 *
 * "Automático" on its own is a promise with no content — automatic according to
 * what? Claro and Oscuro need no explanation; a row of filler text under them
 * would be noise.
 */
const EXPLANATIONS: Partial<Record<ThemePreference, string>> = {
  system: 'Sigue la configuración de tu teléfono',
};

/** One option. Marked, not merely tinted — see the note on the state below. */
function Option({
  option,
  checked,
  onPress,
}: {
  option: ThemePreference;
  checked: boolean;
  onPress: (option: ThemePreference) => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const colors = useColors();
  const label = themePreferenceLabel(option);
  const explanation = EXPLANATIONS[option];

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      // Announced, not just drawn. A tick glyph is invisible to a screen reader,
      // and this screen is nothing BUT a choice — without this, it reads as
      // three identical buttons.
      accessibilityState={{ checked }}
      onPress={() => onPress(option)}
      style={styles.row}
    >
      <View style={styles.rowText}>
        <AppText variant="body">{label}</AppText>
        {explanation ? (
          <AppText variant="caption" muted>
            {explanation}
          </AppText>
        ) : null}
      </View>
      {checked ? <Ionicons name="checkmark" size={20} color={colors.primary} /> : null}
    </Pressable>
  );
}

/**
 * Presentational theme picker. Pure: no store, no navigation, no port.
 *
 * A LIST OF THREE ROWS RATHER THAN A SWITCH, and that is the whole reason this
 * is a screen instead of a toggle on the settings list. A switch can express two
 * states, and there are three — the third, "follow the phone", is the one most
 * people want once they know it exists, and it has no room to explain itself
 * beside a toggle.
 */
export function ThemeView({ preference, onSelect }: ThemeViewProps) {
  const styles = useThemedStyles(makeStyles);

  return (
    <Screen padded={false} edges={BELOW_HEADER_EDGES}>
      <ScrollView contentContainerStyle={styles.content}>
        <View accessibilityRole="radiogroup" style={styles.rows}>
          {THEME_PREFERENCE_OPTIONS.map((option) => (
            <Option
              key={option}
              option={option}
              checked={option === preference}
              // Reported even when it is already the selected one. Swallowing it
              // would make the only control on screen a silent no-op, and it is
              // the tap that repairs a stored value that drifted from the
              // painted one.
              onPress={onSelect}
            />
          ))}
        </View>

        <AppText variant="caption" muted style={styles.note}>
          Tu elección queda guardada en este teléfono y en tu cuenta, así la
          encontrás igual en cualquier otro.
        </AppText>
      </ScrollView>
    </Screen>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    content: { paddingVertical: spacing.md, gap: spacing.md },
    rows: {
      backgroundColor: colors.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    rowText: { flex: 1, gap: spacing.xs },
    note: { paddingHorizontal: spacing.md, borderRadius: radius.sm },
  });
