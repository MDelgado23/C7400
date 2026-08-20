import { render, fireEvent } from '@testing-library/react-native';
import { CategoryBar } from '../CategoryBar';
import type { NewsCategory } from '../newsCategories';

const CATEGORIES: NewsCategory[] = [
  { id: 'loc', name: 'Locales' },
  { id: 'pol', name: 'Policiales' },
  { id: 'dep', name: 'Deportes' },
];

async function renderBar(selectedId: string | null = null, categories = CATEGORIES) {
  const onSelect = jest.fn();
  const view = await render(
    <CategoryBar categories={categories} selectedId={selectedId} onSelect={onSelect} />,
  );
  return { onSelect, view };
}

describe('CategoryBar', () => {
  it('offers every section the newsroom files under', async () => {
    const { view } = await renderBar();

    for (const category of CATEGORIES) {
      expect(view.getByText(category.name)).toBeTruthy();
    }
  });

  // Without it there is no way back to the whole feed once a section is picked.
  it('always offers a way back to everything', async () => {
    const { view } = await renderBar();

    expect(view.getByText('Todas')).toBeTruthy();
  });

  it('hands back the id of the section that was tapped', async () => {
    const { onSelect, view } = await renderBar();

    await fireEvent.press(view.getByText('Policiales'));

    expect(onSelect).toHaveBeenCalledWith('pol');
  });

  // Null and not an id: "everything" is the absence of a filter, not a section
  // of its own, and the API has no id for it.
  it('hands back nothing at all for Todas', async () => {
    const { onSelect, view } = await renderBar('pol');

    await fireEvent.press(view.getByText('Todas'));

    expect(onSelect).toHaveBeenCalledWith(null);
  });

  describe('which one is on', () => {
    it('marks the chosen section for a screen reader', async () => {
      const { view } = await renderBar('dep');

      expect(view.getByLabelText('Deportes').props.accessibilityState).toMatchObject({
        selected: true,
      });
      expect(view.getByLabelText('Locales').props.accessibilityState).toMatchObject({
        selected: false,
      });
    });

    it('marks Todas when no section is chosen', async () => {
      const { view } = await renderBar(null);

      expect(view.getByLabelText('Todas').props.accessibilityState).toMatchObject({
        selected: true,
      });
    });
  });

  // The list is decoration: when it could not be fetched the feed carries on
  // without it rather than showing a lone, useless "Todas".
  it('shows nothing at all when there are no sections', async () => {
    const { view } = await renderBar(null, []);

    expect(view.queryByText('Todas')).toBeNull();
  });
});
