import { useCallback, useEffect } from 'react';
import { Linking, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SponsorSheetView } from './SponsorSheetView';
import { sheetBottomInset } from '../auth/sheetInsets';
import { buildSponsorLinks, type SponsorLink } from '../../core/sponsors/sponsorLinks';
import { trackError, trackEvent } from '../../core/observability/observability';
import { EVENTS } from '../../core/observability/events';
import type { Sponsor } from '../../core/sponsors/sponsor';

interface SponsorSheetProps {
  /** The sponsor being looked at, or null when the sheet is closed. */
  sponsor: Sponsor | null;
  onClose: () => void;
}

/**
 * The sponsor sheet's container: the only place the link builder, `Linking` and
 * the observability port meet.
 *
 * EVERY BUTTON IN HERE LEAVES THE APP, and that is the whole feature. The url
 * goes to the operating system, which opens the sponsor's own app when it is
 * installed and the browser when it is not — no in-app browser, nothing to come
 * back from except the OS task switcher. The radio keeps playing throughout,
 * because audio lives in the audio service and has no idea this happened.
 *
 * `Linking.canOpenURL` is deliberately NOT consulted. On Android 11+ package
 * visibility makes it answer `false` for any scheme the manifest did not
 * declare, whether or not something can handle it, so gating on it would hide
 * working buttons. `openURL` is called directly and the refusal is handled.
 */
export function SponsorSheet({ sponsor, onClose }: SponsorSheetProps) {
  const safeArea = useSafeAreaInsets();
  const links = sponsor === null ? [] : buildSponsorLinks(sponsor);

  // Reported when the sheet opens rather than when the tile is tapped, so the
  // number means "somebody looked at this sponsor" and not "somebody's thumb
  // brushed the grid". Keyed on the id so re-renders do not inflate it.
  const sponsorId = sponsor?.id;
  useEffect(() => {
    if (sponsorId === undefined) return;
    trackEvent(EVENTS.SPONSOR_OPENED, { sponsor_id: sponsorId });
  }, [sponsorId]);

  const handleOpenLink = useCallback(
    (link: SponsorLink) => {
      if (sponsor === null) return;
      // Reported BEFORE the hand-off: once the OS switches apps this component
      // may never run another line, and the tap is the thing being counted.
      trackEvent(EVENTS.SPONSOR_LINK_TAPPED, { sponsor_id: sponsor.id, kind: link.kind });
      // The sheet stays open on purpose: coming back from Instagram should land
      // on the sponsor that was being looked at, not on a grid that forgot.
      Linking.openURL(link.url).catch((error: unknown) => {
        // Nothing to tell the listener — there is no second way to open it. But
        // a systematic failure here means a paid-for button leads nowhere, and
        // nothing else in the app would ever say so.
        trackError(error, `sponsors.open.${link.kind}`);
      });
    },
    [sponsor],
  );

  return (
    <Modal
      visible={sponsor !== null}
      transparent
      animationType="slide"
      // The hardware back button is a way out on Android, same as "Cerrar".
      onRequestClose={onClose}
      // The app draws edge-to-edge, so without these the dimmed backdrop stops
      // short of the system bars and the sheet sits on a strip of bare screen.
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View style={styles.backdrop}>
        {/* Tapping the dimmed area closes it — the gesture every sheet has. */}
        <Pressable
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.dismissArea}
          onPress={onClose}
        />
        {sponsor !== null ? (
          <SponsorSheetView
            sponsor={sponsor}
            links={links}
            onOpenLink={handleOpenLink}
            onDismiss={onClose}
            // No keyboard in this sheet, so this only ever clears the navigation
            // bar — but it is the same rule the auth sheet had to work out, and
            // there is no reason to discover it twice.
            bottomInset={sheetBottomInset({ keyboardHeight: 0, safeAreaBottom: safeArea.bottom })}
          />
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  dismissArea: { flex: 1 },
});
