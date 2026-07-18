import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../ui/atoms/Screen';
import { AppText } from '../../ui/atoms/AppText';
import { Spinner } from '../../ui/atoms/Spinner';
import { BackgroundPlaybackNotice } from '../../ui/organisms/BackgroundPlaybackNotice';
import { colors, radius, spacing } from '../../ui/theme';
import { toggleIntent, type PlayerState } from '../../core/store/playerStore';

/** Station logo, shown as the player artwork when no program image is available. */
const LOGO_AM = require('../../../assets/logo-am.png');

interface PlayerScreenViewProps {
  state: PlayerState;
  title: string;
  imageUrl?: string;
  onToggle: () => void;
  onRetry: () => void;
  /** Show the "background playback at risk" notice above the player. */
  backgroundNoticeVisible?: boolean;
  onEnableBackground?: () => void;
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
}: PlayerScreenViewProps) {
  const willPause = toggleIntent(state) === 'pause';
  const isBuffering = state === 'buffering';
  const controlLabel = isBuffering ? 'Cargando' : willPause ? 'Pausar' : 'Reproducir';

  return (
    <Screen>
      {backgroundNoticeVisible ? (
        <View style={styles.notice}>
          <BackgroundPlaybackNotice onEnable={onEnableBackground ?? (() => {})} />
        </View>
      ) : null}

      <View style={styles.content}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.artwork} />
        ) : (
          <Image
            source={LOGO_AM}
            style={styles.artwork}
            resizeMode="cover"
            accessibilityLabel="Logo de LU32"
          />
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
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={controlLabel}
              onPress={onToggle}
              style={styles.playButton}
              hitSlop={12}
            >
              {isBuffering ? (
                <Spinner size={40} color={colors.text} />
              ) : (
                <Ionicons
                  name={willPause ? 'pause' : 'play'}
                  size={40}
                  color={colors.text}
                  style={willPause ? undefined : styles.playIconOffset}
                />
              )}
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
    width: 88,
    height: 88,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The play triangle reads as left-heavy in a circle; nudge it to optical centre.
  playIconOffset: { marginLeft: 4 },
  retryButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
});
