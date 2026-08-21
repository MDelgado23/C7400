import { registerRootComponent } from 'expo';

import App from './App';
import { setObservabilitySink } from './src/core/observability/observability';
import { firebaseSink } from './src/core/observability/firebaseSink';
import { setAuthProvider, startAnonymousSession } from './src/core/auth/authService';
import { firebaseAuthProvider } from './src/core/auth/firebaseAuthAdapter';
import { setFavoritesProvider } from './src/core/favorites/favoritesService';
import { firestoreFavoritesProvider } from './src/core/favorites/firestoreFavoritesAdapter';
import { setSponsorsStore } from './src/core/sponsors/sponsorsCache';
import { asyncStorageSponsorsStore } from './src/core/sponsors/asyncStorageSponsorsStore';
import { setThemeStore, setThemeSyncProvider } from './src/core/theme/themeService';
import { asyncStorageThemeStore } from './src/core/theme/asyncStorageThemeStore';
import { firestoreThemeProvider } from './src/core/theme/firestoreThemeAdapter';

// Registered HERE, at module scope, and deliberately not from a React effect.
// `config_fallback_used` is reported from inside `loadRemoteConfig()`, which is
// the first await of App's boot effect, and its result is cached for the whole
// session — so it fires at most once, before any effect-based registration
// could have run, and would be lost forever. This is also the one report that
// says the app is serving hardcoded defaults, which is exactly the state you
// cannot afford to be blind to.
//
// This is the single line that binds the app to a provider. Everything else
// goes through the port.
setObservabilitySink(firebaseSink);

// Same reasoning, one step earlier: the auth listener has to be attached before
// anything can ask who the user is, and it is the listener firing that restores
// the session saved on the device. Registering from an effect would leave the
// first render of every screen believing nobody is signed in.
setAuthProvider(firebaseAuthProvider);

// Registered AFTER auth, and that order is load-bearing: the favourites port
// follows the signed-in user, so it has to be listening before the session is
// restored or it would miss the report that tells it whose list to open.
setFavoritesProvider(firestoreFavoritesProvider);

// Storage for the sponsors cache, registered at module scope for the same
// reason as the rest: the Auspiciantes tab reads the cache in its first effect,
// and an adapter registered from a React effect could lose that race — the port
// would answer "nothing cached", the grid would show a spinner it did not need,
// and the phone would pay for a full download it already had on disk.
setSponsorsStore(asyncStorageSponsorsStore);

// The theme, and this one is registered at module scope more urgently than any
// of the others: the read it kicks off is what the SPLASH WAITS ON. Anything
// later — a React effect, a lazy import — would reveal the app on the default
// palette and repaint it a frame afterwards, in front of the user. The whole
// reason the choice is cached on the device is to make that impossible.
//
// The device store goes FIRST and the account provider second, and the order is
// load-bearing in both directions. The port settles hydration on its own when no
// device store is registered, so registering the account provider first would
// declare the app hydrated on the default and let the splash lift early. And the
// account provider follows the signed-in user, so it has to come AFTER
// setAuthProvider or it misses the report that says whose preference to read —
// the same reasoning as the favourites port above.
setThemeStore(asyncStorageThemeStore);
setThemeSyncProvider(firestoreThemeProvider);

// Give the device an identity so anything it saves outlives the session.
//
// Deliberately NOT awaited and deliberately unable to reject: this is a radio,
// and it has to play whether or not there is an account behind it. Internally it
// waits for the restored session before deciding, so a cold boot cannot mint a
// second uid over an account that already exists.
void startAnonymousSession();

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
