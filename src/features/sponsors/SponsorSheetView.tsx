import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '../../ui/atoms/AppText';
import { colors, radius, spacing } from '../../ui/theme';
import type { SponsorLink, SponsorLinkKind } from '../../core/sponsors/sponsorLinks';
import type { Sponsor } from '../../core/sponsors/sponsor';

interface SponsorSheetViewProps {
  sponsor: Sponsor;
  links: SponsorLink[];
  onOpenLink: (link: SponsorLink) => void;
  onDismiss: () => void;
  /** Space to leave below the content — see `sheetInsets`. */
  bottomInset: number;
}

/**
 * The icon for each channel.
 *
 * Kept in the VIEW rather than in the link model: which glyph represents
 * WhatsApp is a presentation decision, and `sponsorLinks` has no business
 * knowing that this app draws with Ionicons.
 */
const ICONS: Record<SponsorLinkKind, keyof typeof Ionicons.glyphMap> = {
  whatsapp: 'logo-whatsapp',
  phone: 'call',
  instagram: 'logo-instagram',
  facebook: 'logo-facebook',
  website: 'globe-outline',
  address: 'location-outline',
};

/**
 * Presentational sponsor sheet: who they are, and the ways to reach them.
 *
 * Every button here leaves the app. Tapping one hands the url to the operating
 * system, which opens the sponsor's own app when it is installed and the
 * browser when it is not — so this sheet is the last thing the listener sees
 * before they are somewhere else, and the radio keeps playing behind them.
 */
export function SponsorSheetView({
  sponsor,
  links,
  onOpenLink,
  onDismiss,
  bottomInset,
}: SponsorSheetViewProps) {
  return (
    <View style={[styles.sheet, { paddingBottom: bottomInset }]}>
      <View style={styles.grabber} />

      <View style={styles.header}>
        {/* Light plate behind the artwork: sponsors supply whatever logo they
            have, and a dark one on transparency would vanish into the navy. */}
        <Image
          testID="sheet-logo"
          source={{ uri: sponsor.logoUrl }}
          style={styles.logo}
          resizeMode="contain"
          accessible={false}
        />
        <View style={styles.headerText}>
          <AppText variant="title">{sponsor.name}</AppText>
          {sponsor.description ? (
            <AppText testID="sponsor-description" variant="body" muted>
              {sponsor.description}
            </AppText>
          ) : null}
        </View>
      </View>

      {links.length > 0 ? (
        <View style={styles.links}>
          {links.map((link) => (
            <Pressable
              key={link.kind}
              testID={`link-${link.kind}`}
              accessibilityRole="button"
              accessibilityLabel={link.label}
              onPress={() => onOpenLink(link)}
              style={styles.link}
            >
              <Ionicons name={ICONS[link.kind]} size={22} color={colors.text} />
              <AppText variant="subtitle">{link.label}</AppText>
            </Pressable>
          ))}
        </View>
      ) : (
        // Honest rather than empty: the sheet opened, and there is genuinely
        // nowhere to send anybody yet.
        <AppText muted style={styles.noLinks}>
          Sin enlaces por ahora
        </AppText>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Cerrar"
        onPress={onDismiss}
        style={styles.dismiss}
        hitSlop={12}
      >
        <AppText variant="subtitle" muted>
          Cerrar
        </AppText>
      </Pressable>
    </View>
  );
}

const LOGO = 64;

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.lg,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
  },
  header: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  headerText: { flex: 1, gap: spacing.xs },
  logo: {
    width: LOGO,
    height: LOGO,
    borderRadius: radius.sm,
    backgroundColor: colors.text,
  },
  links: { gap: spacing.sm },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  noLinks: { textAlign: 'center' },
  dismiss: { alignSelf: 'center', paddingVertical: spacing.sm },
});
