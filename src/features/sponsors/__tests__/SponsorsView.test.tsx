import { render, fireEvent } from '@testing-library/react-native';
import { SponsorsView } from '../SponsorsView';
import type { SponsorsStatus } from '../sponsorsStatus';
import type { Sponsor } from '../../../core/sponsors/sponsor';

function sponsorsOf(...names: string[]): Sponsor[] {
  return names.map((name) => ({
    id: name.toLowerCase(),
    name,
    logoUrl: `https://cdn.lu32.com.ar/sponsors/${name.toLowerCase()}.png`,
  }));
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

    // Distinct from the error: there is nothing to retry, so no button.
    it('says so plainly when the radio has no sponsors', async () => {
      const { view } = await renderView('empty');

      expect(view.getByText('Todavía no hay auspiciantes')).toBeTruthy();
      expect(view.queryByLabelText('Reintentar')).toBeNull();
    });
  });

  describe('the grid', () => {
    it('draws one tile per sponsor', async () => {
      const { view } = await renderView('ready', THREE);

      for (const sponsor of THREE) {
        expect(view.getByTestId(`sponsor-${sponsor.id}`)).toBeTruthy();
      }
    });

    // The grid is three COLUMNS, not a fixed 3x3: five sponsors means five
    // tiles and a short last row, never four empty boxes.
    it.each([1, 2, 4, 5, 9, 11])('draws exactly %i tiles for %i sponsors', async (count) => {
      const names = Array.from({ length: count }, (_, index) => `Sponsor${index}`);
      const { view } = await renderView('ready', sponsorsOf(...names));

      expect(view.getAllByTestId(/^sponsor-/)).toHaveLength(count);
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
});
