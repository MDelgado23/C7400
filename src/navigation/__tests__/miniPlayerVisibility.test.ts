import { shouldShowMiniPlayer } from '../miniPlayerVisibility';

describe('shouldShowMiniPlayer', () => {
  it('hides the mini-player on the full-player (Radio) tab', () => {
    expect(shouldShowMiniPlayer('Radio')).toBe(false);
  });

  it('shows the mini-player on Noticias', () => {
    expect(shouldShowMiniPlayer('Noticias')).toBe(true);
  });

  it('shows the mini-player on any future section by default', () => {
    expect(shouldShowMiniPlayer('Podcasts')).toBe(true);
    expect(shouldShowMiniPlayer('Eventos')).toBe(true);
    expect(shouldShowMiniPlayer('Clima')).toBe(true);
  });

  it('defaults to showing when there is no active route yet', () => {
    expect(shouldShowMiniPlayer(undefined)).toBe(true);
  });
});
