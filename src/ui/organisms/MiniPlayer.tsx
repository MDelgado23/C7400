import { usePlayerStore } from '../../core/store/playerStore';
import { toggle } from '../../core/audio/audioService';
import { MiniPlayerView } from './MiniPlayerView';

/**
 * Container for the mini-player. Subscribes to the store with narrow selectors
 * (so a title change never re-renders on every playback tick) and wires the
 * toggle action to the audio engine. Presentation lives in MiniPlayerView.
 *
 * Falls back to "LU32 en vivo" when no now-playing metadata is available,
 * satisfying the now-playing fallback requirement.
 */
export function MiniPlayer() {
  const state = usePlayerStore((s) => s.state);
  const program = usePlayerStore((s) => s.program);

  return (
    <MiniPlayerView
      state={state}
      title={program?.title ?? 'LU32 en vivo'}
      imageUrl={program?.imageUrl}
      onToggle={toggle}
    />
  );
}
