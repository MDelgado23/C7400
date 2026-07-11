import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { BottomTabBar, createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { PlayerScreen } from '../features/radio/PlayerScreen';
import { NewsStack } from './NewsStack';
import { MiniPlayer } from '../ui/organisms/MiniPlayer';
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
 * Root shell: bottom tabs (Radio · Noticias) with the persistent MiniPlayer
 * rendered ABOVE the tab bar via a custom `tabBar`. Because the tab bar is
 * rendered once (outside the screens), the MiniPlayer is a single instance that
 * survives tab switches — audio never remounts.
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
        tabBar={(props) => (
          <>
            <MiniPlayer />
            <BottomTabBar {...props} />
          </>
        )}
      >
        <Tab.Screen name="Radio" component={PlayerScreen} />
        <Tab.Screen name="Noticias" component={NewsStack} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
