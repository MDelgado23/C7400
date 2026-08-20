import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import { Screen } from '../../ui/atoms/Screen';
import { AppText } from '../../ui/atoms/AppText';
import { colors, radius, spacing } from '../../ui/theme';
import { GRID_CONTENT_PADDING, GRID_GAP, gridMetrics, gridSlots } from './grid';
import type { SponsorsStatus } from './sponsorsStatus';
import type { Sponsor } from '../../core/sponsors/sponsor';

interface SponsorsViewProps {
  status: SponsorsStatus;
  sponsors: Sponsor[];
  onRetry: () => void;
  onSelectSponsor: (sponsor: Sponsor) => void;
}

/**
 * Presentational sponsors grid.
 *
 * THREE COLUMNS, AND THE FIRST SCREEN IS ALWAYS A WHOLE 3x3. A radio with five
 * sponsors shows five logos and four quiet holes: five of nine places taken,
 * rather than a section that ran out halfway down. Past nine the holes stop —
 * they would be below the fold, where they are only empty space to scroll past.
 *
 * The holes are deliberately STILL. A shimmering skeleton says "this is
 * loading", and a skeleton that never resolves says it forever — the same kind
 * of confident lie this codebase spends its time removing. Nothing moves, so
 * nothing is promised.
 *
 * The tile is sized against the measured box rather than a percentage, because
 * three columns is only half the constraint: three ROWS have to fit too, and on
 * a short screen the height is what runs out. See `gridMetrics`.
 */
export function SponsorsView({ status, sponsors, onRetry, onSelectSponsor }: SponsorsViewProps) {
  const window = useWindowDimensions();
  /**
   * Seeded from the window and refined by layout.
   *
   * Both values are OUTER boxes, the same thing `onLayout` reports, because
   * `gridMetrics` is what subtracts the content padding. Mixing the two — an
   * inner seed and an outer measurement — is exactly what put two tiles on a
   * row instead of three.
   *
   * The width is known before the first paint, and on every phone modelled so
   * far the width is what limits the tile, so the first frame is already the
   * right size and nothing visibly snaps into place. The height starts
   * unbounded and only ever makes the tile SMALLER, on the screens too short to
   * hold three rows of it.
   */
  const [box, setBox] = useState({
    width: window.width,
    height: Number.POSITIVE_INFINITY,
  });

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setBox((current) =>
      current.width === width && current.height === height ? current : { width, height },
    );
  };

  if (status === 'loading') {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator accessibilityLabel="Cargando auspiciantes" color={colors.text} />
        </View>
      </Screen>
    );
  }

  if (status === 'error') {
    return (
      <Screen>
        <View style={styles.center}>
          <AppText style={styles.errorText}>No pudimos cargar los auspiciantes</AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Reintentar"
            onPress={onRetry}
            style={styles.retry}
            hitSlop={12}
          >
            <AppText variant="subtitle">Reintentar</AppText>
          </Pressable>
        </View>
      </Screen>
    );
  }

  if (status === 'empty') {
    return (
      <Screen>
        <View style={styles.center}>
          {/* No grid of nine holes here: with nobody signed up at all, nine
              placeholders would read as a section still loading. */}
          <AppText muted>Todavía no hay auspiciantes</AppText>
        </View>
      </Screen>
    );
  }

  const { tileWidth, logoSide } = gridMetrics(box);
  const slots = gridSlots(sponsors);

  return (
    <Screen padded={false}>
      <AppText variant="subtitle" style={styles.heading}>
        Nos acompañan
      </AppText>
      {/*
        A ScrollView with a wrapping row rather than FlatList + numColumns.
        Virtualising a handful of tiles buys nothing, and numColumns stretches
        the items of an incomplete last row unless it is fought — which is
        precisely the case this layout has to get right.

        `flexGrow` with a centred content box does one more job: when the nine
        fit, the leftover height becomes symmetric margin and the grid reads as
        placed; when there are more than nine, it scrolls from the top as usual.
      */}
      <ScrollView contentContainerStyle={styles.scroll} onLayout={handleLayout}>
        <View style={styles.grid}>
          {slots.map((slot) =>
            slot.kind === 'sponsor' ? (
              <Pressable
                key={slot.sponsor.id}
                testID={`sponsor-${slot.sponsor.id}`}
                accessibilityRole="button"
                accessibilityLabel={slot.sponsor.name}
                onPress={() => onSelectSponsor(slot.sponsor)}
                style={[styles.tile, { width: tileWidth }]}
              >
                {/*
                  A light plate behind every logo. Sponsors supply whatever
                  artwork they have, and a dark logo on transparency would
                  vanish into the navy background — the one thing this section
                  may never do to the businesses paying for it.
                */}
                <Image
                  testID={`logo-${slot.sponsor.id}`}
                  source={{ uri: slot.sponsor.logoUrl }}
                  style={[styles.logo, { width: logoSide, height: logoSide }]}
                  resizeMode="contain"
                  accessible={false}
                />
                <AppText variant="caption" numberOfLines={1} style={styles.tileName}>
                  {slot.sponsor.name}
                </AppText>
              </Pressable>
            ) : (
              <View
                key={slot.key}
                testID={`slot-${slot.key}`}
                // Carries no information: announcing four blanks after the real
                // sponsors would make the section longer to listen to and no
                // more useful.
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={[styles.tile, styles.emptyTile, { width: tileWidth }]}
              >
                <View style={[styles.emptyPlate, { width: logoSide, height: logoSide }]} />
                {/* Reserves the same line the sponsor names occupy, so a hole is
                    exactly the size of the tile it is standing in for. */}
                <AppText variant="caption"> </AppText>
              </View>
            ),
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  errorText: { color: colors.error },
  retry: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  heading: { paddingHorizontal: spacing.md, paddingTop: spacing.md },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: GRID_CONTENT_PADDING },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: GRID_GAP,
  },
  tile: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: spacing.xs,
    alignItems: 'center',
  },
  logo: {
    borderRadius: radius.sm,
    backgroundColor: colors.text,
  },
  tileName: { textAlign: 'center' },
  emptyTile: {
    // Nothing behind it and a dashed outline in front: a place, not a thing.
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
  },
  emptyPlate: {
    borderRadius: radius.sm,
    backgroundColor: colors.border,
    opacity: 0.35,
  },
});
