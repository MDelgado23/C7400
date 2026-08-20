import { Linking } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { SponsorSheet } from '../SponsorSheet';
import {
  __resetObservability,
  setObservabilitySink,
} from '../../../core/observability/observability';
import type { Sponsor } from '../../../core/sponsors/sponsor';

/** Android phone with the three-button navigation bar. */
const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 24, left: 0, right: 0, bottom: 48 },
};

const FRAVEGA: Sponsor = {
  id: 'fravega',
  name: 'Frávega',
  logoUrl: 'https://cdn.lu32.com.ar/sponsors/fravega.png',
  instagram: 'fravega',
  phone: '+543764123456',
};

type Reported = { name: string; params: Record<string, unknown> };

let events: Reported[];
let errors: unknown[];

beforeEach(() => {
  events = [];
  errors = [];
  setObservabilitySink({
    logEvent: (name, params) => events.push({ name, params }),
    logScreen: () => undefined,
    recordError: (error) => errors.push(error),
  });
});

afterEach(() => {
  __resetObservability();
  jest.restoreAllMocks();
});

/** Renders the sheet; `sponsor: null` stands for the closed state. */
async function renderSheet(sponsor: Sponsor | null = FRAVEGA) {
  const onClose = jest.fn();
  await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <SponsorSheet sponsor={sponsor} onClose={onClose} />
    </SafeAreaProvider>,
  );
  return { onClose };
}

/** Replaces Linking.openURL; resolves unless an error is given. */
function mockOpenURL(failure?: Error): jest.SpyInstance {
  return jest
    .spyOn(Linking, 'openURL')
    .mockImplementation(async () => {
      if (failure) throw failure;
      return true;
    });
}

function eventsNamed(name: string): Reported[] {
  return events.filter((event) => event.name === name);
}

describe('SponsorSheet', () => {
  describe('opening', () => {
    it('shows the sponsor and their channels', async () => {
      await renderSheet();

      expect(screen.getByText('Frávega')).toBeTruthy();
      expect(screen.getByLabelText('Instagram')).toBeTruthy();
      expect(screen.getByLabelText('Llamar')).toBeTruthy();
    });

    it('reports that the sponsor was looked at', async () => {
      await renderSheet();

      expect(eventsNamed('sponsor_opened')).toEqual([
        { name: 'sponsor_opened', params: { sponsor_id: 'fravega' } },
      ]);
    });

    it('reports nothing while no sponsor is selected', async () => {
      await renderSheet(null);

      expect(events).toEqual([]);
    });
  });

  describe('tapping a channel', () => {
    it('hands the url to the operating system', async () => {
      const openURL = mockOpenURL();
      await renderSheet();

      await fireEvent.press(screen.getByLabelText('Instagram'));

      expect(openURL).toHaveBeenCalledWith('https://instagram.com/fravega');
    });

    // The number the radio shows the business at renewal time. The sponsor id
    // and the channel both matter: "we sent you 340 visits, 300 of them to
    // WhatsApp" is a different conversation from a single total.
    it('reports which sponsor and which channel', async () => {
      mockOpenURL();
      await renderSheet();

      await fireEvent.press(screen.getByLabelText('Llamar'));

      expect(eventsNamed('sponsor_link_tapped')).toEqual([
        { name: 'sponsor_link_tapped', params: { sponsor_id: 'fravega', kind: 'phone' } },
      ]);
    });

    // Leaving for Instagram and coming back should land on the sheet, not on a
    // grid that forgot which sponsor was being looked at.
    it('stays open behind the app that was launched', async () => {
      mockOpenURL();
      const { onClose } = await renderSheet();

      await fireEvent.press(screen.getByLabelText('Instagram'));

      expect(onClose).not.toHaveBeenCalled();
    });

    // A device with no dialer, no browser, nothing able to take the url. There
    // is nothing for the listener to do about it and nothing to say, but a
    // systematic failure here means a paid-for button leads nowhere — exactly
    // the kind of silence the observability port exists to break.
    it('survives an operating system that refuses the url', async () => {
      mockOpenURL(new Error('No Activity found to handle Intent'));
      const { onClose } = await renderSheet();

      await fireEvent.press(screen.getByLabelText('Instagram'));

      expect(errors).toHaveLength(1);
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  it('closes when dismissed', async () => {
    const { onClose } = await renderSheet();

    await fireEvent.press(screen.getByLabelText('Cerrar'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
