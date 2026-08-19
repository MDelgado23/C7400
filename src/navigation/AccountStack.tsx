import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AccountScreen } from '../features/account/AccountScreen';
import { ChangePasswordScreen } from '../features/account/ChangePasswordScreen';
import { SavedArticlesScreen } from '../features/favorites/SavedArticlesScreen';
import { ArticleDetailScreen } from '../features/news/ArticleDetailScreen';
import { colors } from '../ui/theme';

export type AccountStackParamList = {
  AccountHome: undefined;
  ChangePassword: undefined;
  SavedArticles: undefined;
  ArticleDetail: { id: string };
};

const Stack = createNativeStackNavigator<AccountStackParamList>();

const screenOptions = {
  headerStyle: { backgroundColor: colors.surface },
  headerTintColor: colors.text,
  contentStyle: { backgroundColor: colors.background },
} as const;

/**
 * Cuenta tab: the settings list, plus the destinations it opens.
 *
 * Saved articles are reachable from BOTH here and the Noticias header, and each
 * tab gets its own instance of the screen. That is the point of a tab bar —
 * following a link out of Cuenta into another tab would lose the user's place in
 * the one they came from.
 */
export function AccountStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="AccountHome" options={{ title: 'Cuenta' }}>
        {({ navigation }) => (
          <AccountScreen
            onOpenItem={(id) => {
              // Only rows marked available reach this point; the rest render
              // inert. A switch keeps it that way when the others land.
              if (id === 'saved-articles') navigation.navigate('SavedArticles');
              if (id === 'change-password') navigation.navigate('ChangePassword');
            }}
          />
        )}
      </Stack.Screen>

      <Stack.Screen
        name="ChangePassword"
        component={ChangePasswordScreen}
        options={{ title: 'Cambiar contraseña' }}
      />

      <Stack.Screen name="SavedArticles" options={{ title: 'Notas guardadas' }}>
        {({ navigation }) => (
          <SavedArticlesScreen
            onSelectArticle={(article) => navigation.navigate('ArticleDetail', { id: article.id })}
          />
        )}
      </Stack.Screen>

      <Stack.Screen name="ArticleDetail" options={{ title: '' }}>
        {({ route }) => <ArticleDetailScreen articleId={route.params.id} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
