import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../ui/atoms/Screen';
import { AppText } from '../../ui/atoms/AppText';
import { colors, radius, spacing } from '../../ui/theme';
import type { SavedArticle } from '../../core/favorites/savedArticle';
import type { AccountPrompt, AccountIntent } from './accountPrompt';

export type SavedStatus = 'loading' | 'empty' | 'ready';

/**
 * PURE: the screen's state, from whether the list has arrived and how much is
 * in it.
 *
 * The `loaded` flag is what separates "todavía no llegó" from "no guardaste
 * nada" — an empty list means the second only once the first is true. Articles
 * already in hand win either way: the Firestore cache often delivers before the
 * flag flips, and real content beats a spinner.
 */
export function resolveSavedStatus(list: { loaded: boolean; count: number }): SavedStatus {
  if (list.count > 0) return 'ready';
  return list.loaded ? 'empty' : 'loading';
}

interface SavedArticlesViewProps {
  status: SavedStatus;
  articles: SavedArticle[];
  onSelectArticle: (article: SavedArticle) => void;
  onRemove: (articleId: string) => void;
  /** What to say about the session, or `null` when there is none to talk about. */
  account: AccountPrompt | null;
  onPressAccount: (intent: AccountIntent) => void;
}

/**
 * The permanent account row.
 *
 * Rendered above BOTH the list and the empty state, because the person who has
 * saved nothing is exactly the one who has not discovered any of this yet.
 *
 * Every action is its own button. An anonymous user gets "Crear cuenta" AND
 * "Entrar" side by side: someone who reinstalled the app already has an account,
 * and hiding the login behind a registration form makes them walk through the
 * wrong door to reach it.
 */
function AccountRow({
  prompt,
  onPress,
}: {
  prompt: AccountPrompt;
  onPress: (intent: AccountIntent) => void;
}) {
  return (
    <View style={styles.account}>
      <AppText variant="caption" muted style={styles.accountMessage}>
        {prompt.message}
      </AppText>
      <View style={styles.accountActions}>
        {prompt.actions.map((action) => (
          <Pressable
            key={action.intent}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            onPress={() => onPress(action.intent)}
            hitSlop={8}
            style={styles.accountAction}
          >
            <AppText variant="caption" style={styles.accountActionLabel}>
              {action.label}
            </AppText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/**
 * Presentational saved-articles list. Pure: no store, no navigation — the same
 * three-state shape as `NewsFeedView`, minus the error state, because a list
 * served from the local cache has nothing to fail at.
 */
export function SavedArticlesView({
  status,
  articles,
  onSelectArticle,
  onRemove,
  account,
  onPressAccount,
}: SavedArticlesViewProps) {
  if (status === 'loading') {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator accessibilityLabel="Cargando guardadas" color={colors.text} />
        </View>
      </Screen>
    );
  }

  if (status === 'empty') {
    return (
      <Screen padded={false}>
        {account ? <AccountRow prompt={account} onPress={onPressAccount} /> : null}
        <View style={styles.center}>
          <Ionicons name="bookmark-outline" size={48} color={colors.textMuted} />
          {/* Says how, not just that it is empty: an empty screen that only
              reports emptiness leaves the user unaware the feature exists. */}
          <AppText variant="subtitle" muted style={styles.emptyText}>
            Guardá una nota con el marcador y te la llevás a cualquier celular.
          </AppText>
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      {account ? <AccountRow prompt={account} onPress={onPressAccount} /> : null}
      <FlatList
        data={articles}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable
            testID={`saved-${item.id}`}
            accessibilityRole="button"
            onPress={() => onSelectArticle(item)}
            style={styles.card}
          >
            {item.thumbUrl ?? item.imageUrl ? (
              <Image source={{ uri: item.thumbUrl ?? item.imageUrl }} style={styles.thumb} />
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
            {/* A nested control inside a pressable row: it handles its own tap,
                so removing never also opens the article being removed. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Quitar ${item.title} de guardadas`}
              onPress={() => onRemove(item.id)}
              hitSlop={12}
              style={styles.remove}
            >
              <Ionicons name="bookmark" size={22} color={colors.primary} />
            </Pressable>
          </Pressable>
        )}
      />
    </Screen>
  );
}

const THUMB = 72;

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  emptyText: { textAlign: 'center', paddingHorizontal: spacing.lg },
  list: { padding: spacing.md, gap: spacing.md },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
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
  remove: { paddingHorizontal: spacing.xs },
  account: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  accountMessage: { flex: 1 },
  accountActions: { flexDirection: 'row', gap: spacing.xs },
  accountAction: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primary,
  },
  accountActionLabel: { color: colors.primary },
});
