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
import { radius, spacing, useColors, useThemedStyles, type Palette } from '../../ui/theme';
import { GRID_COLUMNS, GRID_CONTENT_PADDING, GRID_GAP, gridMetrics, gridSlots } from './grid';
import type { SponsorsStatus } from './sponsorsStatus';
import type { Sponsor } from '../../core/sponsors/sponsor';

interface SponsorsViewProps {
  status: SponsorsStatus;
  sponsors: Sponsor[];
  onRetry: () => void;
  onSelectSponsor: (sponsor: Sponsor) => void;
}

/**
 * Everything above the grid on this screen: the status bar, the heading, the
 * mini-player, the tab bar and the system navigation.
 *
 * Used ONLY to seed the very first frame, so the row count starts close instead
 * of at the fallback and visibly re-flowing. `onLayout` replaces it with the
 * real measurement a frame later, which is why being a few points off here
 * costs nothing. Measured at 267dp on the test device.
 */
const CHROME_ESTIMATE = 268;

/**
 * Presentational sponsors grid.
 *
 * THREE COLUMNS, AND AS MANY ROWS AS THE SCREEN HAS ROOM FOR. The columns are
 * fixed because they set the width of a tile; the rows are measured, because a
 * count chosen on one phone is only ever right on that phone — a 3x3 left a
 * third of the test device empty. The rows are stretched to meet the measured
 * height exactly, so the section fills whatever screen it lands on.
 *
 * THE SCREEN IS ALWAYS FULL. Sponsors fill the slots in order and the rest are
 * drawn as holes, so five of them read as five places taken rather than as a
 * section that stopped. Past the visible slots the holes stop: below the fold
 * they would only be empty space to scroll past.
 *
 * The holes are deliberately STILL. A shimmering skeleton says "this is
 * loading", and one that never resolves says it forever — the same kind of
 * confident lie this codebase spends its time removing. Nothing moves, so
 * nothing is promised.
 */
export function SponsorsView({ status, sponsors, onRetry, onSelectSponsor }: SponsorsViewProps) {
  const styles = useThemedStyles(makeStyles);
  const colors = useColors();
  const window = useWindowDimensions();
  /**
   * Seeded from the window, then replaced by the real measurement.
   *
   * Both are OUTER boxes — the same thing `onLayout` reports — because
   * `gridMetrics` is what subtracts the content padding. Mixing the two, an
   * inner seed against an outer measurement, is exactly what once put two tiles
   * on a row instead of three.
   */
  const [box, setBox] = useState({
    width: window.width,
    height: window.height - CHROME_ESTIMATE,
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
            <AppText variant="subtitle" style={styles.onBrand}>
              Reintentar
            </AppText>
          </Pressable>
        </View>
      </Screen>
    );
  }

  if (status === 'empty') {
    return (
      <Screen>
        <View style={styles.center}>
          {/* No grid of holes here: with nobody signed up at all, a screen of
              placeholders would read as a section still loading. */}
          <AppText muted>Todavía no hay auspiciantes</AppText>
        </View>
      </Screen>
    );
  }

  const { tileWidth, tileHeight, plateWidth, plateHeight, rows } = gridMetrics(box);
  // Both sides come from the metrics so the plate keeps the artwork's aspect.
  // Taking the width from the tile instead — as `width: '100%'` did — is what
  // let the shape drift with the screen and put bars around every logo.
  const plateSize = { width: plateWidth, height: plateHeight };
  const slots = gridSlots(sponsors, GRID_COLUMNS * rows);
  const tileSize = { width: tileWidth, height: tileHeight };

  return (
    <Screen padded={false}>
      <AppText variant="subtitle" style={styles.heading}>
        Nos acompañan
      </AppText>
      {/*
        A ScrollView with a wrapping row rather than FlatList + numColumns.
        Virtualising a screenful of tiles buys nothing, and numColumns stretches
        the items of an incomplete last row unless it is fought — which is
        precisely the case this layout has to get right.
      */}
      <ScrollView
        testID="sponsors-grid"
        contentContainerStyle={styles.scroll}
        onLayout={handleLayout}
      >
        <View style={styles.grid}>
          {tileWidth === 0
            ? null
            : slots.map((slot) =>
                slot.kind === 'sponsor' ? (
                  <Pressable
                    key={slot.sponsor.id}
                    testID={`sponsor-${slot.sponsor.id}`}
                    accessibilityRole="button"
                    accessibilityLabel={slot.sponsor.name}
                    onPress={() => onSelectSponsor(slot.sponsor)}
                    style={[styles.tile, tileSize]}
                  >
                    {/*
                      The plate is EXACTLY the shape of the artwork sponsors are
                      asked for, 640x512, which is what leaves `contain` nothing
                      to letterbox: a compliant logo lands edge to edge, neither
                      padded nor cropped. A file that misses the spec still
                      centres safely instead of distorting.

                      Its white is written out rather than themed — see the
                      style. A transparent logo takes the plate as its own
                      background, and a dark wordmark on a dark plate is gone.
                    */}
                    <Image
                      testID={`logo-${slot.sponsor.id}`}
                      source={{ uri: slot.sponsor.logoUrl }}
                      style={[styles.plate, plateSize]}
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
                    // Carries no information: announcing a dozen blanks after
                    // the real sponsors would make the section longer to listen
                    // to and no more useful.
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                    style={[styles.tile, styles.emptyTile, tileSize]}
                  >
                    <View style={[styles.emptyPlate, plateSize]} />
                    {/* Holds the line the sponsor names occupy, so a hole is
                        exactly the size of the tile it stands in for. */}
                    <AppText variant="caption"> </AppText>
                  </View>
                ),
              )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    // Content sitting ON a brand fill. It does NOT follow `colors.text`, and
    // that is the point of the token: in the dark palette the two happen to be
    // the same white, so the difference is invisible — until the light palette
    // makes `text` near-black and the label disappears into a blue button.
    onBrand: { color: colors.onPrimary },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
    errorText: { color: colors.error },
    retry: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: radius.pill,
      backgroundColor: colors.primary,
    },
    heading: { paddingHorizontal: spacing.md, paddingTop: spacing.md },
    scroll: { padding: GRID_CONTENT_PADDING },
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
      justifyContent: 'center',
    },
    plate: {
      borderRadius: radius.sm,
      /*
       * LITERALLY WHITE, in both themes, and not a palette token.
       *
       * Sponsors hand over artwork with a transparent background, so this IS
       * the logo's background — a dark wordmark over a dark plate is simply
       * gone, and that is the one thing this section may never do to the
       * businesses paying to be in it.
       *
       * It used to read `colors.text`, which is white in the dark palette and
       * near-black in the light one. That is also where the black line above
       * and below every white logo came from: with `contain`, the difference
       * between the plate's shape and the artwork's is filled with PLATE.
       */
      backgroundColor: '#FFFFFF',
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
