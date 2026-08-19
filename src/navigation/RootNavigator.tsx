import { useRef } from 'react';
import {
  NavigationContainer,
  DarkTheme,
  useNavigationContainerRef,
} from '@react-navigation/native';
import { BottomTabBar, createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { PlayerScreen } from '../features/radio/PlayerScreen';
import { NewsStack } from './NewsStack';
import { AccountStack } from './AccountStack';
import { accountTabLabel } from '../features/account/accountMenu';
import { useAuthUser } from '../features/auth/useAuthUser';
import { MiniPlayer } from '../ui/organisms/MiniPlayer';
import { shouldShowMiniPlayer, FULL_PLAYER_ROUTE } from './miniPlayerVisibility';
import { colors } from '../ui/theme';
import { trackScreen } from '../core/observability/observability';

const Tab = createBottomTabNavigator();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    primary: colors.primary,
    border: colors.border,
  },
};

/**
 * Root shell: bottom tabs (Radio · Noticias · …) with the persistent MiniPlayer
 * rendered ABOVE the tab bar via a custom `tabBar`. The mini-player shows on
 * every section EXCEPT Radio (which already has the full player), so any future
 * section gets it automatically — see `shouldShowMiniPlayer`. Audio lives in the
 * audio service, not this component, so toggling its visibility never touches
 * playback.
 */
export function RootNavigator() {
  // Open param list: getCurrentRoute() resolves to the DEEPEST active route, so
  // it also returns nested stack screens (NewsFeed, ArticleDetail) that a
  // tabs-only param list would not admit.
  const navigationRef = useNavigationContainerRef<Record<string, object | undefined>>();
  // Last screen reported, so a state change that does not move the user (a tab
  // re-render, a param update) is not counted as another view.
  const reportedScreen = useRef<string | undefined>(undefined);
  // Drives the third tab's label and icon: an anonymous user is invited to
  // "Entrar", a registered one is shown their "Cuenta".
  const user = useAuthUser();
  const isSignedIn = user !== null && !user.isAnonymous;

  const reportCurrentScreen = () => {
    const current = navigationRef.getCurrentRoute()?.name;
    if (!current || current === reportedScreen.current) return;
    reportedScreen.current = current;
    trackScreen(current);
  };

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={navTheme}
      onReady={reportCurrentScreen}
      onStateChange={reportCurrentScreen}
    >
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        }}
        tabBar={(props) => {
          const activeRoute = props.state.routes[props.state.index]?.name;
          return (
            <>
              {shouldShowMiniPlayer(activeRoute) ? (
                <MiniPlayer onPress={() => props.navigation.navigate(FULL_PLAYER_ROUTE)} />
              ) : null}
              <BottomTabBar {...props} />
            </>
          );
        }}
      >
        <Tab.Screen
          name="Radio"
          component={PlayerScreen}
          options={{
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons
                name={focused ? 'radio' : 'radio-outline'}
                size={size}
                color={color}
              />
            ),
          }}
        />
        <Tab.Screen
          name="Noticias"
          component={NewsStack}
          options={{
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons
                name={focused ? 'newspaper' : 'newspaper-outline'}
                size={size}
                color={color}
              />
            ),
          }}
        />
        <Tab.Screen
          name="Cuenta"
          component={AccountStack}
          options={{
            // The ROUTE name stays "Cuenta" while the LABEL changes: screen
            // reports and deep links should not shift under us just because
            // somebody signed in.
            tabBarLabel: accountTabLabel(user),
            // Leaving the tab returns it to the menu. Settings are somewhere you
            // go to do ONE thing, and coming back to a half-filled password form
            // from three tabs away is disorienting — worse, it leaves a typed
            // password sitting on a screen nobody is looking at.
            popToTopOnBlur: true,
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons
                name={
                  isSignedIn
                    ? focused
                      ? 'person'
                      : 'person-outline'
                    : focused
                      ? 'log-in'
                      : 'log-in-outline'
                }
                size={size}
                color={color}
              />
            ),
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
