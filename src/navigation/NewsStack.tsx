import { Pressable } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { NewsFeedScreen } from '../features/news/NewsFeedScreen';
import { ArticleDetailScreen } from '../features/news/ArticleDetailScreen';
import { SavedArticlesScreen } from '../features/favorites/SavedArticlesScreen';
import { spacing, useColors, type Palette } from '../ui/theme';
import { trackEvent } from '../core/observability/observability';
import { EVENTS } from '../core/observability/events';

export type NewsStackParamList = {
  NewsFeed: undefined;
  ArticleDetail: { id: string };
  SavedArticles: undefined;
};

const Stack = createNativeStackNavigator<NewsStackParamList>();

/**
 * Header and page chrome, built from the ACTIVE palette.
 *
 * A function rather than the constant it used to be. The constant froze the
 * navigator's colours at import time, so a stack mounted once would keep a dark
 * header sitting over a light app for the rest of the session.
 */
const stackOptions = (colors: Palette) =>
  ({
    headerStyle: { backgroundColor: colors.surface },
    headerTintColor: colors.text,
    contentStyle: { backgroundColor: colors.background },
  }) as const;

/**
 * Noticias tab: feed → article detail, plus the saved list.
 *
 * Saved articles live INSIDE this stack rather than in their own tab: they are a
 * subset of Noticias, and a radio app's tab bar should keep pointing at the
 * radio. The bookmark in the header is the way in.
 */
export function NewsStack() {
  const colors = useColors();

  return (
    <Stack.Navigator screenOptions={stackOptions(colors)}>
      <Stack.Screen
        name="NewsFeed"
        options={({ navigation }) => ({
          title: 'Noticias',
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Noticias guardadas"
              onPress={() => navigation.navigate('SavedArticles')}
              hitSlop={12}
              style={{ paddingHorizontal: spacing.xs }}
            >
              <Ionicons name="bookmark-outline" size={22} color={colors.text} />
            </Pressable>
          ),
        })}
      >
        {({ navigation }) => (
          <NewsFeedScreen
            onSelectArticle={(item) => {
              trackEvent(EVENTS.ARTICLE_OPENED, { article_id: item.id });
              navigation.navigate('ArticleDetail', { id: item.id });
            }}
          />
        )}
      </Stack.Screen>

      <Stack.Screen name="SavedArticles" options={{ title: 'Guardadas' }}>
        {({ navigation }) => (
          <SavedArticlesScreen
            onSelectArticle={(article) =>
              // Straight to the normal detail screen: it prefers the saved copy,
              // so the article opens from the local cache with no network.
              navigation.navigate('ArticleDetail', { id: article.id })
            }
          />
        )}
      </Stack.Screen>

      <Stack.Screen name="ArticleDetail" options={{ title: '' }}>
        {({ route }) => <ArticleDetailScreen articleId={route.params.id} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
