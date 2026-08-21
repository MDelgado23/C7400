import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { AppText } from '../../ui/atoms/AppText';
import { radius, spacing, useColors, useThemedStyles, type Palette } from '../../ui/theme';
import type { NewsCategory } from './newsCategories';

interface CategoryBarProps {
  categories: NewsCategory[];
  /** The section being shown, or null for the whole feed. */
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

/**
 * The sections of the newsroom, as a row of chips above the feed.
 *
 * "Todas" is null rather than an id of its own: the whole feed is the ABSENCE
 * of a filter, and the API has no id for it. Modelling it as a section would
 * mean inventing a value that then has to be stripped again before every
 * request.
 *
 * It renders NOTHING when the list is empty. The sections are decoration around
 * the news — if the endpoint could not be read, the feed carries on rather than
 * showing a lone, useless "Todas".
 *
 * Presentational: it neither fetches the sections nor knows what choosing one
 * does.
 */
export function CategoryBar({ categories, selectedId, onSelect }: CategoryBarProps) {
  const styles = useThemedStyles(makeStyles);
  if (categories.length === 0) return null;

  const chips: { key: string; label: string; id: string | null }[] = [
    { key: 'todas', label: 'Todas', id: null },
    ...categories.map((category) => ({
      key: category.id,
      label: category.name,
      id: category.id as string | null,
    })),
  ];

  return (
    <ScrollView
      testID="category-bar"
      horizontal
      showsHorizontalScrollIndicator={false}
      // `flexGrow: 0` is load-bearing. A horizontal ScrollView dropped into a
      // flex column takes whatever height is going spare, so on a section with
      // only two notes this bar swallowed a third of the screen and the chips
      // stretched into tall capsules with it. No test could have caught it:
      // the test renderer does no layout at all.
      style={styles.bar}
      contentContainerStyle={styles.barContent}
    >
      {chips.map((chip) => {
        const active = chip.id === selectedId;
        return (
          <Pressable
            key={chip.key}
            accessibilityRole="button"
            accessibilityLabel={chip.label}
            // Carried in the state rather than only in the colour: a screen
            // reader has no way to see which chip is filled in.
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(chip.id)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <AppText variant="caption" style={active ? styles.labelActive : styles.label}>
              {chip.label}
            </AppText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    /** Height comes from the chips, never from what is left over. */
    bar: { flexGrow: 0, flexShrink: 0 },
    barContent: {
      paddingHorizontal: spacing.md,
      /*
       * The gap BELOW the chips is this bar's bottom padding PLUS the list's own
       * top padding, so matching only the bottom value here would leave the row
       * pinned to the header with twice as much air under it. The top padding is
       * their sum instead, and the chips sit centred between the two.
       */
      paddingTop: spacing.sm + spacing.md,
      paddingBottom: spacing.sm,
      gap: spacing.sm,
      // Belt and braces: even if something above ever hands this bar more height,
      // the chips stay their own size instead of stretching to fill it.
      alignItems: 'center',
    },
    chip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    label: { color: colors.textMuted },
    // On the active chip, which is a brand fill — not the page text colour.
    labelActive: { color: colors.onPrimary },
  });
