import { registerRootComponent } from 'expo';

import App from './App';
import { setObservabilitySink } from './src/core/observability/observability';
import { firebaseSink } from './src/core/observability/firebaseSink';

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

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
