import { render, fireEvent } from '@testing-library/react-native';
import { SponsorsView } from '../SponsorsView';
import { GRID_MIN_SLOTS } from '../grid';
import type { SponsorsStatus } from '../sponsorsStatus';
import type { Sponsor } from '../../../core/sponsors/sponsor';

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

/**
 * The empty slots on purpose carry `accessibilityElementsHidden`, and RNTL's
 * queries honour that by default — so reaching them at all takes opting in.
 */
const HIDDEN = { includeHiddenElements: true } as const;

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
    // grid of nine holes either, which would suggest the section is loading.
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

  // THE FIRST SCREEN IS ALWAYS A WHOLE 3x3. Five sponsors read as five of nine
  // places taken, not as a section that ran out halfway down the screen.
  describe('the empty slots', () => {
    it.each([1, 3, 5, 8])('fills the first nine slots when there are %i sponsors', async (count) => {
      const { view } = await renderView('ready', manySponsors(count));

      expect(view.getAllByTestId(/^sponsor-/)).toHaveLength(count);
      expect(view.getAllByTestId(/^slot-empty/, HIDDEN)).toHaveLength(GRID_MIN_SLOTS - count);
    });

    it('adds none when the nine are taken', async () => {
      const { view } = await renderView('ready', manySponsors(9));

      expect(view.queryAllByTestId(/^slot-empty/, HIDDEN)).toHaveLength(0);
    });

    // Past nine the holes would sit below the fold, where they would only be
    // empty space somebody had to scroll to find.
    it.each([10, 14])('adds none when there are %i sponsors', async (count) => {
      const { view } = await renderView('ready', manySponsors(count));

      expect(view.getAllByTestId(/^sponsor-/)).toHaveLength(count);
      expect(view.queryAllByTestId(/^slot-empty/, HIDDEN)).toHaveLength(0);
    });

    // A hole is a hole. Tapping one must not open a sheet for nobody.
    it('cannot be tapped', async () => {
      const { onSelectSponsor, view } = await renderView('ready', manySponsors(5));

      await fireEvent.press(view.getAllByTestId(/^slot-empty/, HIDDEN)[0]);

      expect(onSelectSponsor).not.toHaveBeenCalled();
    });

    // They carry no information. Announcing four blanks after the real sponsors
    // would make the section longer to listen to and no more useful.
    // Asserted through the query itself: RNTL honours accessibility
    // visibility, so a hole being unreachable WITHOUT opting in is the proof
    // that a screen reader will not read it out either.
    it('is hidden from screen readers', async () => {
      const { view } = await renderView('ready', manySponsors(5));

      expect(view.queryAllByTestId(/^slot-empty/)).toHaveLength(0);
      expect(view.getAllByTestId(/^slot-empty/, HIDDEN)).toHaveLength(4);
    });
  });
});
