import { render, fireEvent } from '@testing-library/react-native';
import { SponsorSheetView } from '../SponsorSheetView';
import { buildSponsorLinks } from '../../../core/sponsors/sponsorLinks';
import type { Sponsor } from '../../../core/sponsors/sponsor';

const FRAVEGA: Sponsor = {
  id: 'fravega',
  name: 'Frávega',
  logoUrl: 'https://cdn.lu32.com.ar/sponsors/fravega.png',
  description: 'Electrodomésticos y tecnología',
  whatsapp: '+543764123456',
  instagram: 'fravega',
  website: 'https://www.fravega.com',
};

async function renderSheet(sponsor: Sponsor = FRAVEGA) {
  const onOpenLink = jest.fn();
  const onDismiss = jest.fn();
  const view = await render(
    <SponsorSheetView
      sponsor={sponsor}
      links={buildSponsorLinks(sponsor)}
      onOpenLink={onOpenLink}
      onDismiss={onDismiss}
      bottomInset={24}
    />,
  );
  return { onOpenLink, onDismiss, view };
}

describe('SponsorSheetView', () => {
  it('names the sponsor', async () => {
    const { view } = await renderSheet();

    expect(view.getByText('Frávega')).toBeTruthy();
  });

  it('shows the description when the document supplied one', async () => {
    const { view } = await renderSheet();

    expect(view.getByText('Electrodomésticos y tecnología')).toBeTruthy();
  });

  it('leaves no empty line when there is no description', async () => {
    const { view } = await renderSheet({ ...FRAVEGA, description: undefined });

    expect(view.queryByTestId('sponsor-description')).toBeNull();
  });

  it('shows the sponsor logo', async () => {
    const { view } = await renderSheet();

    expect(view.getByTestId('sheet-logo').props.source).toEqual({ uri: FRAVEGA.logoUrl });
  });

  describe('the channel buttons', () => {
    it('draws one per channel the sponsor has, and no others', async () => {
      const { view } = await renderSheet();

      expect(view.getByLabelText('WhatsApp')).toBeTruthy();
      expect(view.getByLabelText('Instagram')).toBeTruthy();
      expect(view.getByLabelText('Sitio web')).toBeTruthy();
      // Never supplied, so it must not appear as a button that does nothing.
      expect(view.queryByLabelText('Llamar')).toBeNull();
      expect(view.queryByLabelText('Cómo llegar')).toBeNull();
    });

    it('hands back the whole link, url included', async () => {
      const { onOpenLink, view } = await renderSheet();

      await fireEvent.press(view.getByLabelText('Instagram'));

      expect(onOpenLink).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'instagram', url: 'https://instagram.com/fravega' }),
      );
    });

    // A sponsor the radio has not finished loading details for. The sheet still
    // opens and names them; it just has nowhere to send anybody.
    it('says so when the sponsor has no channels at all', async () => {
      const { view } = await renderSheet({
        id: 'panaderia',
        name: 'Panadería',
        logoUrl: 'https://cdn.lu32.com.ar/sponsors/panaderia.png',
      });

      expect(view.getByText('Sin enlaces por ahora')).toBeTruthy();
    });
  });

  it('can be dismissed', async () => {
    const { onDismiss, view } = await renderSheet();

    await fireEvent.press(view.getByLabelText('Cerrar'));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
