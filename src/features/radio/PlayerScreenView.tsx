import { ActivityIndicator, Image, Pressable, StyleSheet, View } from 'react-native';
import { Screen } from '../../ui/atoms/Screen';
import { AppText } from '../../ui/atoms/AppText';
import { BackgroundPlaybackNotice } from '../../ui/organisms/BackgroundPlaybackNotice';
import { colors, radius, spacing } from '../../ui/theme';
import { toggleIntent, type PlayerState } from '../../core/store/playerStore';

interface PlayerScreenViewProps {
  state: PlayerState;
  title: string;
  imageUrl?: string;
  onToggle: () => void;
  onRetry: () => void;
  /** Show the "background playback at risk" notice above the player. */
  backgroundNoticeVisible?: boolean;
  onEnableBackground?: () => void;
  onDismissBackground?: () => void;
}

/**
 * Presentational full-screen player (the "Radio" tab). Pure: all state and
 * callbacks arrive via props. The error state swaps the play control for a
 * retry action so a failed stream never leaves the user with a dead button.
 */
export function PlayerScreenView({
  state,
  title,
  imageUrl,
  onToggle,
  onRetry,
  backgroundNoticeVisible = false,
  onEnableBackground,
  onDismissBackground,
}: PlayerScreenViewProps) {
  const willPause = toggleIntent(state) === 'pause';
  const controlLabel = willPause ? 'Pausar' : 'Reproducir';

  return (
    <Screen>
      {backgroundNoticeVisible ? (
        <View style={styles.notice}>
          <BackgroundPlaybackNotice
            onEnable={onEnableBackground ?? (() => {})}
            onDismiss={onDismissBackground ?? (() => {})}
          />
        </View>
      ) : null}

      <View style={styles.content}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.artwork} />
        ) : (
          <View style={styles.artwork} />
        )}

        <AppText variant="title" style={styles.title} numberOfLines={2}>
          {title}
        </AppText>
        <AppText variant="subtitle" muted>
          LU32 en vivo
        </AppText>

        {state === 'error' ? (
          <View style={styles.block}>
            <AppText variant="body" style={styles.errorText}>
              No pudimos conectar con la radio
            </AppText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Reintentar"
              onPress={onRetry}
              style={styles.retryButton}
              hitSlop={12}
            >
              <AppText variant="subtitle">Reintentar</AppText>
            </Pressable>
          </View>
        ) : (
          <View style={styles.block}>
            {state === 'buffering' ? (
              <ActivityIndicator accessibilityLabel="Cargando" color={colors.text} />
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={controlLabel}
              onPress={onToggle}
              style={styles.playButton}
              hitSlop={12}
            >
              <AppText variant="title">{willPause ? '❚❚' : '▶'}</AppText>
            </Pressable>
          </View>
        )}
      </View>
    </Screen>
  );
}

const ARTWORK_SIZE = 220;

const styles = StyleSheet.create({
  notice: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  artwork: {
    width: ARTWORK_SIZE,
    height: ARTWORK_SIZE,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryDark,
  },
  title: { textAlign: 'center' },
  block: {
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  errorText: { color: colors.error },
  playButton: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
});
