import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '../atoms/AppText';
import { Spinner } from '../atoms/Spinner';
import { colors, radius, spacing } from '../theme';
import { toggleIntent, type PlayerState } from '../../core/store/playerStore';

/** Station badge, shown as the mini-player artwork when no program image exists. */
const LOGO_AM = require('../../../assets/logo-am.png');

interface MiniPlayerViewProps {
  state: PlayerState;
  title: string;
  imageUrl?: string;
  onToggle: () => void;
  /** Tap the bar body (not the play/pause button) → open the full player. */
  onPress?: () => void;
}

/**
 * Presentational mini-player. Pure: no store, no audio engine — everything
 * arrives via props so it renders identically in tests and in the app.
 * The play/pause affordance is derived from the shared `toggleIntent` so the
 * button always matches what a tap will actually do. Tapping the bar body opens
 * the full player; the play/pause button is a nested control that handles its
 * own tap.
 */
export function MiniPlayerView({
  state,
  title,
  imageUrl,
  onToggle,
  onPress,
}: MiniPlayerViewProps) {
  const willPause = toggleIntent(state) === 'pause';
  const isBuffering = state === 'buffering';
  const controlLabel = isBuffering ? 'Cargando' : willPause ? 'Pausar' : 'Reproducir';

  return (
    <Pressable
      style={styles.container}
      onPress={onPress}
      // Not an a11y element itself, so the logo and the play/pause button below
      // stay individually accessible (and queryable). The bar tap is a bonus for
      // sighted users; the Radio tab is the labelled way in for screen readers.
      accessible={false}
      testID="mini-player-bar"
    >
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.artwork} resizeMode="cover" />
      ) : (
        <Image
          source={LOGO_AM}
          style={styles.artwork}
          resizeMode="cover"
          accessibilityLabel="Logo de LU32"
        />
      )}

      <View style={styles.info}>
        <AppText variant="subtitle" numberOfLines={1}>
          {title}
        </AppText>
        <AppText variant="caption" muted>
          LU32 en vivo
        </AppText>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={controlLabel}
        onPress={onToggle}
        hitSlop={8}
        style={styles.control}
      >
        {isBuffering ? (
          <Spinner size={22} thickness={2} color={colors.text} />
        ) : (
          <Ionicons
            name={willPause ? 'pause' : 'play'}
            size={26}
            color={colors.text}
            style={willPause ? undefined : styles.playIconOffset}
          />
        )}
      </Pressable>
    </Pressable>
  );
}

const ARTWORK_SIZE = 44;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  artwork: {
    width: ARTWORK_SIZE,
    height: ARTWORK_SIZE,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryDark,
  },
  info: { flex: 1 },
  control: {
    paddingHorizontal: spacing.sm,
    minWidth: 40,
    alignItems: 'center',
  },
  // The play triangle reads as left-heavy; nudge it to optical centre.
  playIconOffset: { marginLeft: 3 },
});
