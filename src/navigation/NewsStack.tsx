import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NewsFeedScreen } from '../features/news/NewsFeedScreen';
import { ArticleDetailScreen } from '../features/news/ArticleDetailScreen';
import { colors } from '../ui/theme';

export type NewsStackParamList = {
  NewsFeed: undefined;
  ArticleDetail: { id: string };
};

const Stack = createNativeStackNavigator<NewsStackParamList>();

const screenOptions = {
  headerStyle: { backgroundColor: colors.surface },
  headerTintColor: colors.text,
  contentStyle: { backgroundColor: colors.background },
} as const;

/** Noticias tab: feed → article detail. */
export function NewsStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="NewsFeed" options={{ title: 'Noticias' }}>
        {({ navigation }) => (
          <NewsFeedScreen
            onSelectArticle={(item) => navigation.navigate('ArticleDetail', { id: item.id })}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="ArticleDetail" options={{ title: '' }}>
        {({ route }) => <ArticleDetailScreen articleId={route.params.id} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
