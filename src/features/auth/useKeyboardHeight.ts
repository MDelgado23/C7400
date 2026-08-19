import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * The height of the on-screen keyboard, or 0 when it is closed.
 *
 * Measured by hand because the usual tools do not reach inside a `Modal`: on
 * Android the modal is a separate Dialog window that never receives the
 * activity's `adjustResize`, so `KeyboardAvoidingView` has nothing to react to.
 * Listening to the keyboard directly works the same on both platforms.
 *
 * iOS gets the `Will` events so the sheet travels WITH the keyboard animation;
 * Android only emits the `Did` events, where the movement lands a frame late but
 * is the only signal there is.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const shown = Keyboard.addListener(showEvent, (event) => {
      setHeight(event.endCoordinates?.height ?? 0);
    });
    const hidden = Keyboard.addListener(hideEvent, () => setHeight(0));

    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  return height;
}
