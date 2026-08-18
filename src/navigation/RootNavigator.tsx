import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { BottomTabBar, createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { PlayerScreen } from '../features/radio/PlayerScreen';
import { NewsStack } from './NewsStack';
import { MiniPlayer } from '../ui/organisms/MiniPlayer';
import { shouldShowMiniPlayer, FULL_PLAYER_ROUTE } from './miniPlayerVisibility';
import { colors } from '../ui/theme';

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
  return (
    <NavigationContainer theme={navTheme}>
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
      </Tab.Navigator>
    </NavigationContainer>
  );
}
