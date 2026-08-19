import { useEffect, useState } from 'react';
import { getCurrentUser, subscribeToUser, type AppUser } from '../../core/auth/authService';

/**
 * The signed-in user, kept in sync with the auth port.
 *
 * Seeded from `getCurrentUser()` rather than from `null`: by the time any screen
 * mounts the session has usually been restored already, and starting at null
 * would render one frame of signed-out UI before correcting itself — a "Crear
 * cuenta" button flashing at someone who has an account.
 */
export function useAuthUser(): AppUser | null {
  const [user, setUser] = useState<AppUser | null>(getCurrentUser);

  useEffect(() => subscribeToUser(setUser), []);

  return user;
}
