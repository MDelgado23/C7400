/**
 * The tab that hosts the FULL player (the Radio screen). The mini-player would
 * be redundant there, so it's the single tab we hide it on.
 */
export const FULL_PLAYER_ROUTE = 'Radio';

/**
 * PURE: should the persistent mini-player show for the given active tab?
 *
 * The mini-player follows the user into every section EXCEPT the full-player
 * tab. This is defined as an *exclusion* on purpose: any section added later
 * (Podcasts, Eventos, …) gets the mini-player automatically, with zero extra
 * wiring. `undefined` (no active route yet) defaults to showing it.
 */
export function shouldShowMiniPlayer(activeRouteName: string | undefined): boolean {
  return activeRouteName !== FULL_PLAYER_ROUTE;
}
