import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Screen } from '../../ui/atoms/Screen';
import { AppText } from '../../ui/atoms/AppText';
import { colors, radius, spacing } from '../../ui/theme';
import type { ArticleDetail } from './newsMapping';

export type DetailStatus = 'loading' | 'error' | 'ready';

interface ArticleDetailViewProps {
  status: DetailStatus;
  article?: ArticleDetail;
  onRetry: () => void;
}

/**
 * Presentational article detail. Renders the full body as native text
 * paragraphs (see htmlToParagraphs) inside a ScrollView. The persistent
 * mini-player lives above the navigator, so audio keeps playing while reading.
 */
export function ArticleDetailView({ status, article, onRetry }: ArticleDetailViewProps) {
  if (status === 'loading') {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator accessibilityLabel="Cargando nota" color={colors.text} />
        </View>
      </Screen>
    );
  }

  if (status === 'error' || !article) {
    return (
      <Screen>
        <View style={styles.center}>
          <AppText style={styles.errorText}>No pudimos cargar la nota</AppText>
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

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.content}>
        {article.imageUrl ? (
          <Image source={{ uri: article.imageUrl }} style={styles.hero} />
        ) : null}
        {article.kicker ? (
          <AppText variant="caption" muted>
            {article.kicker}
          </AppText>
        ) : null}
        <AppText variant="title">{article.title}</AppText>
        {article.summary ? (
          <AppText variant="subtitle" muted>
            {article.summary}
          </AppText>
        ) : null}
        {article.paragraphs.map((paragraph, index) => (
          <AppText key={index} variant="body" style={styles.paragraph}>
            {paragraph}
          </AppText>
        ))}
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
  content: { padding: spacing.md, gap: spacing.sm },
  hero: {
    width: '100%',
    height: 200,
    borderRadius: radius.md,
    backgroundColor: colors.primaryDark,
    marginBottom: spacing.sm,
  },
  paragraph: { lineHeight: 22 },
});
