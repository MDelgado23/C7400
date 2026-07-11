import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, View } from 'react-native';
import { Screen } from '../../ui/atoms/Screen';
import { AppText } from '../../ui/atoms/AppText';
import { colors, radius, spacing } from '../../ui/theme';
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
}

/**
 * Presentational news feed. Renders one of four discrete states so the
 * container only has to map query state → status. Pure: no data fetching here.
 */
export function NewsFeedView({ status, items, onRetry, onSelectArticle }: NewsFeedViewProps) {
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
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable
            testID={`article-${item.id}`}
            accessibilityRole="button"
            onPress={() => onSelectArticle(item)}
            style={styles.card}
          >
            {item.imageUrl ? (
              <Image source={{ uri: item.imageUrl }} style={styles.thumb} />
            ) : (
              <View style={styles.thumb} />
            )}
            <View style={styles.cardBody}>
              {item.kicker ? (
                <AppText variant="caption" muted>
                  {item.kicker}
                </AppText>
              ) : null}
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
});
