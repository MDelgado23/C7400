import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SponsorsSnapshot, SponsorsStore } from './sponsorsCache';

/**
 * AsyncStorage adapter for the sponsors cache.
 *
 * THE ONLY FILE IN THE APP THAT IMPORTS AsyncStorage. Everything else talks to
 * `sponsorsCache`, so swapping the storage engine — or adding a second consumer
 * such as the pending theme preference — is a change confined to this layer.
 *
 * Deliberately thin: it moves bytes and does not interpret them. Deciding what
 * a valid snapshot is belongs in the port, where the SAME sanitiser is applied
 * to whatever comes off the network, so there is one answer to that question
 * rather than two that can drift apart.
 */

/**
 * Where the snapshot lives.
 *
 * The trailing version is load-bearing: if the stored shape ever changes,
 * bumping it abandons the old cache in one edit instead of shipping a migration
 * for two kilobytes that the next fetch would replace anyway.
 */
export const SPONSORS_CACHE_KEY = 'lu32.sponsors.v1';

export const asyncStorageSponsorsStore: SponsorsStore = {
  /**
   * The stored snapshot, unvalidated.
   *
   * `JSON.parse` throws on the half-written document an OS-killed app leaves
   * behind. That is left to propagate on purpose: the port already turns a
   * failed read into "nothing cached", which is precisely the right outcome,
   * and catching it here would only duplicate that decision.
   */
  async read(): Promise<unknown> {
    const raw = await AsyncStorage.getItem(SPONSORS_CACHE_KEY);
    return raw === null ? null : JSON.parse(raw);
  },

  async write(snapshot: SponsorsSnapshot): Promise<void> {
    await AsyncStorage.setItem(SPONSORS_CACHE_KEY, JSON.stringify(snapshot));
  },
};
