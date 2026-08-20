import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Screen } from '../../ui/atoms/Screen';
import { AppText } from '../../ui/atoms/AppText';
import { colors, radius, spacing } from '../../ui/theme';
import type { SponsorsStatus } from './sponsorsStatus';
import type { Sponsor } from '../../core/sponsors/sponsor';

interface SponsorsViewProps {
  status: SponsorsStatus;
  sponsors: Sponsor[];
  onRetry: () => void;
  onSelectSponsor: (sponsor: Sponsor) => void;
}

/**
 * Presentational sponsors grid. Renders one of four discrete states, so the
 * container only has to hand over a status — no fetching here.
 *
 * THREE COLUMNS, AS MANY ROWS AS THERE ARE. Not a fixed 3x3: nine sponsors look
 * exactly like the 3x3 that was asked for, but five produce five tiles and a
 * short last row rather than four empty boxes, and a tenth sponsor appears
 * instead of being silently dropped. Which sponsors exist is a commercial
 * question that changes every few months; a layout that encodes an answer to it
 * would have to be rewritten each time it did.
 */
export function SponsorsView({ status, sponsors, onRetry, onSelectSponsor }: SponsorsViewProps) {
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
          {/* No retry button: the fetch worked, there is simply nobody yet. */}
          <AppText muted>Todavía no hay auspiciantes</AppText>
        </View>
      </Screen>
    );
  }

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
      */}
      <ScrollView contentContainerStyle={styles.grid}>
        {sponsors.map((sponsor) => (
          <Pressable
            key={sponsor.id}
            testID={`sponsor-${sponsor.id}`}
            accessibilityRole="button"
            accessibilityLabel={sponsor.name}
            onPress={() => onSelectSponsor(sponsor)}
            style={styles.tile}
          >
            {/*
              A light plate behind every logo. Sponsors supply whatever artwork
              they have, and a dark logo on transparency would vanish into the
              navy background — the one thing this section may never do to the
              businesses paying for it.
            */}
            <Image
              testID={`logo-${sponsor.id}`}
              source={{ uri: sponsor.logoUrl }}
              style={styles.logo}
              resizeMode="contain"
              accessible={false}
            />
            <AppText variant="caption" numberOfLines={2} style={styles.tileName}>
              {sponsor.name}
            </AppText>
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}

/** Three per row, with the gap taken out of each tile's share. */
const COLUMN_WIDTH = '31%';

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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: spacing.md,
    gap: spacing.sm,
  },
  tile: {
    width: COLUMN_WIDTH,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: spacing.xs,
    alignItems: 'center',
  },
  logo: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.sm,
    backgroundColor: colors.text,
  },
  tileName: { textAlign: 'center' },
});
