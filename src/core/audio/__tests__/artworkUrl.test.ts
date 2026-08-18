import { validArtworkUrl } from '../artworkUrl';

describe('validArtworkUrl', () => {
  it('returns undefined for missing input', () => {
    expect(validArtworkUrl(undefined)).toBeUndefined();
    expect(validArtworkUrl('')).toBeUndefined();
  });

  it('drops scheme-less values (the bundled-asset id that crashed the app)', () => {
    // This exact value threw MalformedURLException in setActiveForLockScreen.
    expect(validArtworkUrl('assets_logoam')).toBeUndefined();
    expect(validArtworkUrl('/data/user/0/app/logo.png')).toBeUndefined();
  });

  it('accepts http(s) and file URLs', () => {
    expect(validArtworkUrl('https://cdn.lu32.com/art.png')).toBe(
      'https://cdn.lu32.com/art.png',
    );
    expect(validArtworkUrl('http://x/y.png')).toBe('http://x/y.png');
    expect(validArtworkUrl('file:///data/cache/logo-am.png')).toBe(
      'file:///data/cache/logo-am.png',
    );
  });

  it('rejects other schemes we cannot guarantee media3 loads', () => {
    expect(validArtworkUrl('content://media/1')).toBeUndefined();
    expect(validArtworkUrl('android.resource://pkg/raw/logo')).toBeUndefined();
  });
});
