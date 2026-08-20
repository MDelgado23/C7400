import { useCallback, useState } from 'react';
import { SponsorsView } from './SponsorsView';
import { SponsorSheet } from './SponsorSheet';
import { useSponsors } from './useSponsors';
import type { Sponsor } from '../../core/sponsors/sponsor';

/**
 * Container for the Auspiciantes tab.
 *
 * Owns exactly one piece of state — which sponsor is being looked at — because
 * everything else already belongs somewhere: the data to `useSponsors`, the
 * layout to `SponsorsView`, and what a tap on a channel does to `SponsorSheet`.
 *
 * The selected sponsor is held as the WHOLE object rather than an id. Holding
 * an id would mean looking it up again on every render against a list that a
 * background revalidation can replace underneath — and a sponsor dropped from
 * the document mid-session would make the open sheet vanish in the reader's
 * hands. The object they tapped is the object they keep until they close it.
 */
export function SponsorsScreen() {
  const { status, sponsors, retry } = useSponsors();
  const [selected, setSelected] = useState<Sponsor | null>(null);

  const closeSheet = useCallback(() => setSelected(null), []);

  return (
    <>
      <SponsorsView
        status={status}
        sponsors={sponsors}
        onRetry={retry}
        onSelectSponsor={setSelected}
      />
      <SponsorSheet sponsor={selected} onClose={closeSheet} />
    </>
  );
}
