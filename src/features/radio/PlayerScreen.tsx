import { usePlayerStore } from '../../core/store/playerStore';
import { retry, toggle } from '../../core/audio/audioService';
import { PlayerScreenView } from './PlayerScreenView';

/**
 * Container for the Radio tab. Subscribes to the store with narrow selectors
 * and wires the play/pause + retry actions to the audio engine. Falls back to
 * "LU32 en vivo" when no now-playing metadata is available.
 */
export function PlayerScreen() {
  const state = usePlayerStore((s) => s.state);
  const program = usePlayerStore((s) => s.program);

  return (
    <PlayerScreenView
      state={state}
      title={program?.title ?? 'LU32 en vivo'}
      imageUrl={program?.imageUrl}
      onToggle={toggle}
      onRetry={retry}
    />
  );
}
