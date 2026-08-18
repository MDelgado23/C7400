import { render } from '@testing-library/react-native';
import { Spinner } from '../Spinner';

// The Spinner is decorative (accessibilityElementsHidden), so testID queries
// must opt into hidden elements.
const opts = { includeHiddenElements: true } as const;

describe('Spinner', () => {
  it('renders a ring element', async () => {
    const view = await render(<Spinner testID="spinner" />);
    expect(view.getByTestId('spinner', opts)).toBeTruthy();
  });

  it('is hidden from accessibility (the host control carries the label)', async () => {
    const view = await render(<Spinner testID="spinner" />);
    expect(
      view.getByTestId('spinner', opts).props.accessibilityElementsHidden,
    ).toBe(true);
  });
});
