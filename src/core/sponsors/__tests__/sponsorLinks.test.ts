import { buildSponsorLinks } from '../sponsorLinks';
import type { Sponsor } from '../sponsor';

function sponsor(overrides: Partial<Sponsor> = {}): Sponsor {
  return {
    id: 'fravega',
    name: 'Frávega',
    logoUrl: 'https://cdn.lu32.com.ar/sponsors/fravega.png',
    ...overrides,
  };
}

/** The url built for one channel, or undefined when no button was produced. */
function urlFor(input: Partial<Sponsor>, kind: string): string | undefined {
  return buildSponsorLinks(sponsor(input)).find((link) => link.kind === kind)?.url;
}

describe('buildSponsorLinks', () => {
  it('produces nothing for a sponsor with no channels', () => {
    expect(buildSponsorLinks(sponsor())).toEqual([]);
  });

  it('produces a button only for the channels the sponsor actually has', () => {
    const kinds = buildSponsorLinks(sponsor({ instagram: 'fravega', phone: '+543764123456' })).map(
      (link) => link.kind,
    );

    expect(kinds).toEqual(['phone', 'instagram']);
  });

  // Contact first, presence second, location last: the audience of an AM radio
  // in the interior calls and writes far more than it browses.
  it('orders the buttons the same way for every sponsor', () => {
    const kinds = buildSponsorLinks(
      sponsor({
        address: 'Av. Mitre 1234',
        website: 'https://fravega.com',
        facebook: 'fravega',
        instagram: 'fravega',
        phone: '+543764123456',
        whatsapp: '+543764123456',
      }),
    ).map((link) => link.kind);

    expect(kinds).toEqual(['whatsapp', 'phone', 'instagram', 'facebook', 'website', 'address']);
  });

  it('gives every button a non-empty label', () => {
    const links = buildSponsorLinks(
      sponsor({ whatsapp: '+543764123456', instagram: 'fravega', address: 'Av. Mitre 1234' }),
    );

    expect(links.length).toBeGreaterThan(0);
    for (const link of links) expect(link.label.trim().length).toBeGreaterThan(0);
  });

  describe('instagram', () => {
    it('builds an https profile url from a bare handle', () => {
      expect(urlFor({ instagram: 'fravega' }, 'instagram')).toBe('https://instagram.com/fravega');
    });

    it('strips a leading @, which is how people write handles', () => {
      expect(urlFor({ instagram: '@fravega' }, 'instagram')).toBe('https://instagram.com/fravega');
    });

    // The likeliest authoring mistake: pasting the profile URL into a field
    // documented as a handle. Recovered rather than rendered as a broken link.
    it.each([
      'https://instagram.com/fravega',
      'https://www.instagram.com/fravega/',
      'instagram.com/fravega',
      'https://instagram.com/fravega?igsh=abc123',
    ])('recovers the handle from a pasted %s', (pasted) => {
      expect(urlFor({ instagram: pasted }, 'instagram')).toBe('https://instagram.com/fravega');
    });
  });

  describe('facebook', () => {
    it('builds an https page url from a username', () => {
      expect(urlFor({ facebook: 'fravega' }, 'facebook')).toBe('https://facebook.com/fravega');
    });

    // Pages without a vanity name are only reachable by numeric id, and the same
    // facebook.com/<value> shape serves both.
    it('accepts a numeric page id just as well', () => {
      expect(urlFor({ facebook: '100064012345678' }, 'facebook')).toBe(
        'https://facebook.com/100064012345678',
      );
    });
  });

  describe('website', () => {
    // Already forced to https by the parser; nothing left to do but hand it over.
    it('passes the url through untouched', () => {
      expect(urlFor({ website: 'https://www.fravega.com/sucursales' }, 'website')).toBe(
        'https://www.fravega.com/sucursales',
      );
    });
  });

  describe('whatsapp', () => {
    // wa.me takes digits only: no +, no spaces, no dashes, country code included.
    it('reduces a human-written number to the digits wa.me expects', () => {
      expect(urlFor({ whatsapp: '+54 9 3764 12-3456' }, 'whatsapp')).toBe(
        'https://wa.me/5493764123456',
      );
    });

    it.each(['+543764123456', '00543764123456', '543764123456'])(
      'strips the international prefix from %s',
      (written) => {
        expect(urlFor({ whatsapp: written }, 'whatsapp')).toBe('https://wa.me/543764123456');
      },
    );

    it.each(['1234', 'no es un numero', '--'])('drops the button for %s', (written) => {
      expect(urlFor({ whatsapp: written }, 'whatsapp')).toBeUndefined();
    });
  });

  describe('phone', () => {
    // The + is what makes a number dialable from outside the country, so it is
    // preserved when the document wrote one — and not invented when it did not.
    it('keeps the + on an international number', () => {
      expect(urlFor({ phone: '+54 9 3764 12-3456' }, 'phone')).toBe('tel:+5493764123456');
    });

    it('turns a 00 prefix into the + it stands for', () => {
      expect(urlFor({ phone: '0054 9 3764 123456' }, 'phone')).toBe('tel:+5493764123456');
    });

    it('leaves a local number local instead of guessing a country code', () => {
      expect(urlFor({ phone: '4451234' }, 'phone')).toBe('tel:4451234');
    });

    it.each(['12345', 'llamanos', ''])('drops the button for %s', (written) => {
      expect(urlFor({ phone: written }, 'phone')).toBeUndefined();
    });
  });

  describe('address', () => {
    it('builds a maps search that both platforms resolve', () => {
      expect(urlFor({ address: 'Av. Mitre 1234, Oberá' }, 'address')).toBe(
        'https://www.google.com/maps/search/?api=1&query=Av.%20Mitre%201234%2C%20Ober%C3%A1',
      );
    });
  });

  // THE INVARIANT THIS MODULE EXISTS FOR. Every value below is hostile: a
  // scheme, a traversal, a foreign host. None of it may survive into a url,
  // because these strings come from a document in a public repo and end up at
  // Linking.openURL — where an intent:// would launch another app entirely.
  describe('the app owns the scheme', () => {
    const hostile = sponsor({
      instagram: 'javascript:alert(1)',
      facebook: '../../../evil',
      whatsapp: 'intent://evil#Intent;scheme=http;end',
      phone: 'intent://evil#Intent;end',
      address: 'javascript:alert(1)',
    });

    it('never emits a url outside https: or tel:', () => {
      for (const link of buildSponsorLinks(hostile)) {
        expect(link.url).toMatch(/^(https:\/\/|tel:)/);
      }
    });

    it('keeps every https url on the host the app chose', () => {
      const allowed = ['instagram.com', 'facebook.com', 'wa.me', 'www.google.com'];

      for (const link of buildSponsorLinks(hostile)) {
        if (!link.url.startsWith('https://')) continue;
        expect(allowed).toContain(new URL(link.url).host);
      }
    });

    it('never lets a tel: carry anything but a dialable number', () => {
      for (const link of buildSponsorLinks(hostile)) {
        if (!link.url.startsWith('tel:')) continue;
        expect(link.url).toMatch(/^tel:\+?\d+$/);
      }
    });
  });
});
