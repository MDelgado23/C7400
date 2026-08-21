import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BELOW_HEADER_EDGES, Screen } from '../../ui/atoms/Screen';
import { AppText } from '../../ui/atoms/AppText';
import { colors, radius, spacing } from '../../ui/theme';
import type { AccountItem, AccountItemId, AccountSection } from './accountMenu';

interface SessionSummary {
  isAnonymous: boolean;
  email: string | null;
}

interface AccountViewProps {
  /** `null` while auth has not reported yet. */
  session: SessionSummary | null;
  sections: AccountSection[];
  onSelectItem: (id: AccountItemId) => void;
  onSignIn: () => void;
  onSignUp: () => void;
  onSignOut: () => void;
}

/** One settings row. Inert when its destination does not exist yet. */
function Row({ item, onPress }: { item: AccountItem; onPress: (id: AccountItemId) => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.label}
      // `disabled`, not just an absent handler: without it the press bubbles to
      // whatever ancestor does have one. And the row has to LOOK unavailable
      // too, or the user taps it again assuming the app froze.
      disabled={!item.available}
      onPress={() => onPress(item.id)}
      style={[styles.row, !item.available && styles.rowInert]}
    >
      <AppText variant="body" style={styles.rowLabel}>
        {item.label}
      </AppText>
      {item.detail ? (
        <AppText variant="caption" muted>
          {item.detail}
        </AppText>
      ) : null}
      {item.available ? (
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      ) : (
        <AppText variant="caption" muted>
          Próximamente
        </AppText>
      )}
    </Pressable>
  );
}

/**
 * Presentational account tab. Pure: no store, no navigation.
 *
 * Three states, and the first one matters more than it looks: until auth
 * reports we show neither the menu nor the pitch, because guessing wrong for a
 * frame means either offering an account to somebody who already has one, or
 * offering settings to somebody who does not.
 */
export function AccountView({
  session,
  sections,
  onSelectItem,
  onSignIn,
  onSignUp,
  onSignOut,
}: AccountViewProps) {
  if (session === null) {
    return (
      <Screen edges={BELOW_HEADER_EDGES}>
        <View style={styles.center}>
          <ActivityIndicator accessibilityLabel="Cargando cuenta" color={colors.text} />
        </View>
      </Screen>
    );
  }

  if (session.isAnonymous) {
    return (
      <Screen edges={BELOW_HEADER_EDGES}>
        <View style={styles.center}>
          <Ionicons name="person-circle-outline" size={64} color={colors.textMuted} />
          <AppText variant="title" style={styles.pitchTitle}>
            Llevate lo tuyo
          </AppText>
          <AppText variant="body" muted style={styles.pitchBody}>
            Con una cuenta, las notas que guardás dejan de vivir solo en este celular y te
            siguen a cualquier otro.
          </AppText>
          <View style={styles.doors}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Crear cuenta"
              onPress={onSignUp}
              style={styles.primaryDoor}
            >
              <AppText variant="subtitle">Crear cuenta</AppText>
            </Pressable>
            {/* Its own door, never behind the other one: someone who reinstalled
                the app already has an account and came here to use it. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Entrar"
              onPress={onSignIn}
              style={styles.secondaryDoor}
            >
              <AppText variant="subtitle" style={styles.secondaryDoorLabel}>
                Entrar
              </AppText>
            </Pressable>
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false} edges={BELOW_HEADER_EDGES}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.identity}>
          <Ionicons name="person-circle" size={40} color={colors.primary} />
          <View style={styles.identityText}>
            <AppText variant="subtitle" numberOfLines={1}>
              {session.email ?? 'Tu cuenta'}
            </AppText>
            <AppText variant="caption" muted>
              Sesión iniciada
            </AppText>
          </View>
        </View>

        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <AppText variant="caption" muted style={styles.sectionTitle}>
              {section.title}
            </AppText>
            <View style={styles.rows}>
              {section.items.map((item) => (
                <Row key={item.id} item={item} onPress={onSelectItem} />
              ))}
            </View>
          </View>
        ))}

        {/* Apart from the sections, and last. Signing out is not a setting. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar sesión"
          onPress={onSignOut}
          style={styles.signOut}
        >
          <AppText variant="body" style={styles.signOutLabel}>
            Cerrar sesión
          </AppText>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  pitchTitle: { textAlign: 'center' },
  pitchBody: { textAlign: 'center', paddingHorizontal: spacing.lg },
  doors: { alignSelf: 'stretch', gap: spacing.sm, paddingHorizontal: spacing.lg, marginTop: spacing.md },
  primaryDoor: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  secondaryDoor: {
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primary,
  },
  secondaryDoorLabel: { color: colors.primary },

  content: { paddingVertical: spacing.md, gap: spacing.lg },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
  },
  identityText: { flex: 1 },

  section: { gap: spacing.xs },
  // Uppercased in CSS, not in JS: the accessible name stays 'Seguridad' rather
  // than becoming something a screen reader may spell out letter by letter.
  sectionTitle: { paddingHorizontal: spacing.md, letterSpacing: 1, textTransform: 'uppercase' },
  rows: {
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  rowInert: { opacity: 0.5 },
  rowLabel: { flex: 1 },

  signOut: {
    marginTop: spacing.md,
    marginHorizontal: spacing.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.error,
  },
  signOutLabel: { color: colors.error },
});
