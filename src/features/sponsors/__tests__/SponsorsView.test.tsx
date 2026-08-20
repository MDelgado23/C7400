import { render, fireEvent } from '@testing-library/react-native';
import { SponsorsView } from '../SponsorsView';
import { GRID_COLUMNS, gridMetrics } from '../grid';
import type { SponsorsStatus } from '../sponsorsStatus';
import type { Sponsor } from '../../../core/sponsors/sponsor';

/**
 * What `onLayout` reports on the Moto G35 the app is tested on. Fired by hand
 * because nothing lays out in this environment — and stated rather than
 * inherited from the test window, so the slot count is a number this file
 * decides instead of one it happens to get.
 */
const MOTO = { width: 432, height: 693 };
/** Five rows on that box, so fifteen visible slots. */
const SLOTS = GRID_COLUMNS * gridMetrics(MOTO).rows;

/**
 * The holes carry `accessibilityElementsHidden`, and RNTL's queries honour that
 * by default — so reaching them at all takes opting in.
 */
const HIDDEN = { includeHiddenElements: true } as const;

function sponsorsOf(...names: string[]): Sponsor[] {
  return names.map((name) => ({
    id: name.toLowerCase(),
    name,
    logoUrl: `https://cdn.lu32.com.ar/sponsors/${name.toLowerCase()}.png`,
  }));
}

function manySponsors(count: number): Sponsor[] {
  return sponsorsOf(...Array.from({ length: count }, (_, index) => `Sponsor${index}`));
}

const THREE = sponsorsOf('Frávega', 'Veterinaria', 'Panadería');

async function renderView(status: SponsorsStatus, sponsors: Sponsor[] = []) {
  const onRetry = jest.fn();
  const onSelectSponsor = jest.fn();
  const view = await render(
    <SponsorsView
      status={status}
      sponsors={sponsors}
      onRetry={onRetry}
      onSelectSponsor={onSelectSponsor}
    />,
  );
  if (status === 'ready') {
    await fireEvent(view.getByTestId('sponsors-grid'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, ...MOTO } },
    });
  }
  return { onRetry, onSelectSponsor, view };
}

describe('SponsorsView', () => {
  describe('while there is nothing to show', () => {
    it('shows a loading indicator', async () => {
      const { view } = await renderView('loading');

      expect(view.getByLabelText('Cargando auspiciantes')).toBeTruthy();
    });

    it('offers a retry when the fetch failed', async () => {
      const { onRetry, view } = await renderView('error');

      expect(view.getByText('No pudimos cargar los auspiciantes')).toBeTruthy();
      await fireEvent.press(view.getByLabelText('Reintentar'));

      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    // Distinct from the error: there is nothing to retry, so no button — and no
    // screen of holes either, which would suggest the section is still loading.
    it('says so plainly when the radio has no sponsors', async () => {
      const { view } = await renderView('empty');

      expect(view.getByText('Todavía no hay auspiciantes')).toBeTruthy();
      expect(view.queryByLabelText('Reintentar')).toBeNull();
      expect(view.queryAllByTestId(/^slot-empty/, HIDDEN)).toHaveLength(0);
    });
  });

  describe('the grid', () => {
    it('draws one tile per sponsor', async () => {
      const { view } = await renderView('ready', THREE);

      for (const sponsor of THREE) {
        expect(view.getByTestId(`sponsor-${sponsor.id}`)).toBeTruthy();
      }
    });

    it('names each tile for a screen reader', async () => {
      const { view } = await renderView('ready', THREE);

      expect(view.getByLabelText('Frávega')).toBeTruthy();
    });

    it('shows the logo the document supplied', async () => {
      const { view } = await renderView('ready', THREE);

      expect(view.getByTestId('logo-frávega').props.source).toEqual({
        uri: 'https://cdn.lu32.com.ar/sponsors/frávega.png',
      });
    });

    it('hands the tapped sponsor back whole', async () => {
      const { onSelectSponsor, view } = await renderView('ready', THREE);

      await fireEvent.press(view.getByTestId('sponsor-veterinaria'));

      expect(onSelectSponsor).toHaveBeenCalledWith(THREE[1]);
    });

    it('keeps the order it was given, which is the order the radio chose', async () => {
      const { view } = await renderView('ready', THREE);
      const ids = view.getAllByTestId(/^sponsor-/).map((tile) => tile.props.testID);

      expect(ids).toEqual(['sponsor-frávega', 'sponsor-veterinaria', 'sponsor-panadería']);
    });
  });

  // THE SCREEN IS ALWAYS FULL, and how full depends on the screen: the rows come
  // from the measured height, so the same five sponsors leave ten holes here and
  // a different number on a shorter phone.
  describe('the holes', () => {
    it.each([1, 3, 5, 11])('fills the visible slots when there are %i sponsors', async (count) => {
      const { view } = await renderView('ready', manySponsors(count));

      expect(view.getAllByTestId(/^sponsor-/)).toHaveLength(count);
      expect(view.getAllByTestId(/^slot-empty/, HIDDEN)).toHaveLength(SLOTS - count);
    });

    it('adds none once every visible slot is taken', async () => {
      const { view } = await renderView('ready', manySponsors(SLOTS));

      expect(view.queryAllByTestId(/^slot-empty/, HIDDEN)).toHaveLength(0);
    });

    // Past the visible slots the holes would sit below the fold, where they
    // would only be empty space somebody had to scroll to find.
    it('adds none when the sponsors overflow the screen', async () => {
      const { view } = await renderView('ready', manySponsors(SLOTS + 4));

      expect(view.getAllByTestId(/^sponsor-/)).toHaveLength(SLOTS + 4);
      expect(view.queryAllByTestId(/^slot-empty/, HIDDEN)).toHaveLength(0);
    });

    // A hole is a hole. Tapping one must not open a sheet for nobody.
    it('cannot be tapped', async () => {
      const { onSelectSponsor, view } = await renderView('ready', manySponsors(5));

      await fireEvent.press(view.getAllByTestId(/^slot-empty/, HIDDEN)[0]);

      expect(onSelectSponsor).not.toHaveBeenCalled();
    });

    // Asserted through the query itself: RNTL honours accessibility visibility,
    // so a hole being unreachable WITHOUT opting in is the proof that a screen
    // reader will not read it out either.
    it('is hidden from screen readers', async () => {
      const { view } = await renderView('ready', manySponsors(5));

      expect(view.queryAllByTestId(/^slot-empty/)).toHaveLength(0);
      expect(view.getAllByTestId(/^slot-empty/, HIDDEN)).toHaveLength(SLOTS - 5);
    });
  });
});
