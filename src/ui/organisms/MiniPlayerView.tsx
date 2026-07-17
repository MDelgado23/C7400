import { ActivityIndicator, Image, Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '../atoms/AppText';
import { colors, radius, spacing } from '../theme';
import { toggleIntent, type PlayerState } from '../../core/store/playerStore';

/** Station badge, shown as the mini-player artwork when no program image exists. */
const LOGO_AM = require('../../../assets/logo-am.png');

interface MiniPlayerViewProps {
  state: PlayerState;
  title: string;
  imageUrl?: string;
  onToggle: () => void;
}

/**
 * Presentational mini-player. Pure: no store, no audio engine — everything
 * arrives via props so it renders identically in tests and in the app.
 * The play/pause affordance is derived from the shared `toggleIntent` so the
 * button always matches what a tap will actually do.
 */
export function MiniPlayerView({ state, title, imageUrl, onToggle }: MiniPlayerViewProps) {
  const willPause = toggleIntent(state) === 'pause';
  const controlLabel = willPause ? 'Pausar' : 'Reproducir';

  return (
    <View style={styles.container}>
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

      {state === 'buffering' ? (
        <ActivityIndicator
          accessibilityLabel="Cargando"
          color={colors.text}
          style={styles.control}
        />
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={controlLabel}
        onPress={onToggle}
        hitSlop={8}
        style={styles.control}
      >
        <AppText variant="title">{willPause ? '❚❚' : '▶'}</AppText>
      </Pressable>
    </View>
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
});
