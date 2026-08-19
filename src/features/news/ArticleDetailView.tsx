import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../ui/atoms/Screen';
import { AppText } from '../../ui/atoms/AppText';
import { colors, radius, spacing } from '../../ui/theme';
import type { ArticleDetail } from './newsMapping';

export type DetailStatus = 'loading' | 'error' | 'ready';

/**
 * What this screen can render: a freshly fetched article, or a saved copy of
 * one. `truncated` is the only thing a saved copy adds that the reader needs to
 * know about, so it is declared here rather than pushed into the news model —
 * the feed has no concept of a body that did not fit.
 */
export type ReadableArticle = ArticleDetail & { truncated?: boolean };

interface ArticleDetailViewProps {
  status: DetailStatus;
  article?: ReadableArticle;
  onRetry: () => void;
  isSaved: boolean;
  onToggleSave: () => void;
}

/**
 * Presentational article detail. Renders the full body as native text
 * paragraphs (see htmlToParagraphs) inside a ScrollView. The persistent
 * mini-player lives above the navigator, so audio keeps playing while reading.
 *
 * The bookmark reflects `isSaved`, which the container reads from the favourites
 * listener rather than from an awaited write — offline that write can stay in
 * flight for hours, and the control has to answer the tap immediately anyway.
 */
export function ArticleDetailView({
  status,
  article,
  onRetry,
  isSaved,
  onToggleSave,
}: ArticleDetailViewProps) {
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

        <Pressable
          accessibilityRole="button"
          // The label carries the state: a screen reader must never be told
          // "Guardar" on a control that would remove the article.
          accessibilityLabel={isSaved ? 'Quitar de guardadas' : 'Guardar nota'}
          accessibilityState={{ selected: isSaved }}
          onPress={onToggleSave}
          hitSlop={8}
          style={[styles.save, isSaved && styles.saveActive]}
        >
          <Ionicons
            name={isSaved ? 'bookmark' : 'bookmark-outline'}
            size={18}
            color={isSaved ? colors.text : colors.primary}
          />
          <AppText variant="caption" style={isSaved ? undefined : styles.saveLabel}>
            {isSaved ? 'Guardada' : 'Guardar'}
          </AppText>
        </Pressable>

        {article.truncated ? (
          // Silent truncation would read as an article that simply ends. Saying
          // it turns a limitation into something the reader can act on.
          <AppText variant="caption" muted style={styles.truncated}>
            Esta nota quedó recortada al guardarla. Abrila en lu32.com.ar para leerla completa.
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
  save: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primary,
    marginVertical: spacing.xs,
  },
  saveActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  saveLabel: { color: colors.primary },
  truncated: { fontStyle: 'italic' },
  paragraph: { lineHeight: 22 },
});
