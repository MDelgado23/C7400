import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BELOW_HEADER_EDGES, Screen } from '../../ui/atoms/Screen';
import { AppText } from '../../ui/atoms/AppText';
import { colors, radius, spacing } from '../../ui/theme';
import { DEFAULT_ASPECT_RATIO } from './photoAsset';
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
  /** Opens the photo on its own, uncropped and zoomable. */
  onOpenPhoto: (uri: string) => void;
}

/**
 * The shape of the photo band at the top of every article.
 *
 * A BAND RATHER THAN THE PHOTO'S OWN SHAPE, because the whole photo now has a
 * place of its own: tapping opens it uncropped and zoomable. Freed from having
 * to show everything, the article can have the thing a page wants — a lead
 * image the same size on every note, so the headline always lands in the same
 * spot and nothing jumps as the reader moves between them.
 *
 * 16:9 measured out best over a hundred of the newsroom's photos. Wider bands
 * crop hard (2:1 loses 28% of the average photo); taller ones barely crop less
 * — 3:2 saves two points — while eating 36% of the screen instead of 30%, which
 * is what pushes the deck and the save button below the fold. At 16:9 the
 * median photo still shows 85% of itself and a third of them show essentially
 * all of it.
 */
export const HERO_BAND_RATIO = 16 / 9;

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
  onOpenPhoto,
}: ArticleDetailViewProps) {
  if (status === 'loading') {
    return (
      <Screen edges={BELOW_HEADER_EDGES}>
        <View style={styles.center}>
          <ActivityIndicator accessibilityLabel="Cargando nota" color={colors.text} />
        </View>
      </Screen>
    );
  }

  if (status === 'error' || !article) {
    return (
      <Screen edges={BELOW_HEADER_EDGES}>
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
    <Screen padded={false} edges={BELOW_HEADER_EDGES}>
      <ScrollView contentContainerStyle={styles.content}>
        {article.imageUrl ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ver la foto completa"
            onPress={() => onOpenPhoto(article.imageUrl as string)}
          >
            <View testID="photo-band" style={styles.band}>
              {/*
                THE PHOTO IS PINNED TO THE TOP OF THE BAND, not centred, and on
                a portrait that is the whole difference. Drawn at its own shape
                and clipped from below, a standing figure keeps its head and
                loses its feet; centred — which is what an image does by default
                — it would keep the torso and cut the face off, in a section
                that is almost entirely photographs of people.
                A photo WIDER than the band has nothing to gain from being
                pinned, so it takes the band's shape and crops at the sides,
                where centred is exactly right.
              */}
              <Image
                testID="article-photo"
                source={{ uri: article.imageUrl }}
                style={{
                  width: '100%',
                  aspectRatio: Math.min(
                    article.imageAspectRatio ?? DEFAULT_ASPECT_RATIO,
                    HERO_BAND_RATIO,
                  ),
                }}
                resizeMode="cover"
              />
            </View>
          </Pressable>
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
  band: {
    width: '100%',
    aspectRatio: HERO_BAND_RATIO,
    // What sticks out below the band is clipped, which is what makes the photo
    // sit against the TOP edge instead of being centred in it.
    overflow: 'hidden',
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
