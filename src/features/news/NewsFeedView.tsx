import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { Screen } from '../../ui/atoms/Screen';
import { AppText } from '../../ui/atoms/AppText';
import { colors, radius, spacing } from '../../ui/theme';
import { publishedLabel } from './publishedLabel';
import type { NewsItem } from './newsMapping';

export type FeedStatus = 'loading' | 'error' | 'empty' | 'ready';

/** PURE: derive the feed's display status from the query state + result size. */
export function resolveFeedStatus(query: {
  isLoading: boolean;
  isError: boolean;
  count: number;
}): FeedStatus {
  if (query.isLoading) return 'loading';
  if (query.isError) return 'error';
  return query.count > 0 ? 'ready' : 'empty';
}

interface NewsFeedViewProps {
  status: FeedStatus;
  items: NewsItem[];
  onRetry: () => void;
  onSelectArticle: (item: NewsItem) => void;
  /** Whether a pull-to-refresh is in flight. */
  refreshing: boolean;
  onRefresh: () => void;
  /** The reader scrolled to the bottom and there may be another page. */
  onEndReached: () => void;
  /** Whether that next page is in flight. */
  loadingMore: boolean;
  /** Whether the week has been covered and there is nothing more to ask for. */
  reachedEnd: boolean;
}

/**
 * Presentational news feed. Renders one of four discrete states so the
 * container only has to map query state → status. Pure: no data fetching here.
 */
export function NewsFeedView({
  status,
  items,
  onRetry,
  onSelectArticle,
  refreshing,
  onRefresh,
  onEndReached,
  loadingMore,
  reachedEnd,
}: NewsFeedViewProps) {
  // Read once per render rather than per card, so every time on screen is
  // measured from the same instant and two notes a second apart cannot end up
  // labelled out of order.
  const now = Date.now();
  if (status === 'loading') {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator accessibilityLabel="Cargando noticias" color={colors.text} />
        </View>
      </Screen>
    );
  }

  if (status === 'error') {
    return (
      <Screen>
        <View style={styles.center}>
          <AppText style={styles.errorText}>No pudimos cargar las noticias</AppText>
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
          <AppText muted>No hay noticias por ahora</AppText>
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <FlatList
        testID="news-list"
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        // The gesture everybody makes on a feed by reflex. Until now it did
        // nothing at all.
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.text}
            colors={[colors.primary]}
          />
        }
        // Half a screen of warning: enough for the next page to land before the
        // reader hits the bottom, without pulling pages they never look at.
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator
              accessibilityLabel="Cargando más noticias"
              color={colors.text}
              style={styles.footer}
            />
          ) : reachedEnd ? (
            // Said out loud rather than left as a list that just stops. It also
            // does the one useful thing an ending can do: point at where the
            // older notes actually are.
            <AppText variant="caption" muted style={styles.footerText}>
              Hasta acá llegan las noticias de la semana. Las más viejas quedan en las que
              guardaste.
            </AppText>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            testID={`article-${item.id}`}
            accessibilityRole="button"
            onPress={() => onSelectArticle(item)}
            style={styles.card}
          >
            {/* Thumb-sized variant, not the hero: this box is 72pt. */}
            {item.thumbUrl ?? item.imageUrl ? (
              <Image
                source={{ uri: item.thumbUrl ?? item.imageUrl }}
                style={styles.thumb}
              />
            ) : (
              <View style={styles.thumb} />
            )}
            <View style={styles.cardBody}>
              {/*
                The section and the time share a line: between them they answer
                "what kind of news is this, and is it happening now" before the
                headline has even been read.
              */}
              <View style={styles.meta}>
                {item.kicker ? (
                  <AppText variant="caption" muted numberOfLines={1} style={styles.kicker}>
                    {item.kicker}
                  </AppText>
                ) : null}
                {/*
                  Absent rather than filled in when the date cannot be read.
                  "Fecha desconocida" would take the same room to say nothing,
                  and a wrong time on a news card is worse than no time at all.
                */}
                {publishedLabel(item.publishedAt, now) !== undefined ? (
                  <AppText testID={`published-${item.id}`} variant="caption" muted>
                    {publishedLabel(item.publishedAt, now)}
                  </AppText>
                ) : null}
              </View>
              <AppText variant="subtitle" numberOfLines={3}>
                {item.title}
              </AppText>
            </View>
          </Pressable>
        )}
      />
    </Screen>
  );
}

const THUMB = 72;

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  errorText: { color: colors.error },
  retry: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  list: { padding: spacing.md, gap: spacing.md },
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryDark,
  },
  cardBody: { flex: 1, justifyContent: 'center', gap: spacing.xs },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  // Shrinks so a long section name never pushes the time off the card.
  kicker: { flexShrink: 1 },
  footer: { paddingVertical: spacing.lg },
  footerText: { textAlign: 'center', paddingVertical: spacing.lg, paddingHorizontal: spacing.md },
});
