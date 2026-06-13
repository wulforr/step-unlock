import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

type Tone = 'info' | 'warning' | 'danger';

const TONE: Record<Tone, { bg: string; fg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  info: { bg: '#1E3A5F', fg: '#9FC6FF', icon: 'information-circle' },
  warning: { bg: '#4A3411', fg: '#F2C57B', icon: 'warning' },
  danger: { bg: '#4A1A1C', fg: '#F6A6A8', icon: 'lock-closed' },
};

/** A compact inline alert used for permission gaps and the warning/lock state. */
export function Banner({
  tone = 'info',
  title,
  message,
}: {
  tone?: Tone;
  title: string;
  message?: string;
}) {
  const t = TONE[tone];
  return (
    <View style={[styles.banner, { backgroundColor: t.bg }]}>
      <Ionicons name={t.icon} size={20} color={t.fg} style={styles.icon} />
      <View style={styles.text}>
        <ThemedText type="smallBold" style={{ color: t.fg }}>
          {title}
        </ThemedText>
        {message ? (
          <ThemedText type="small" style={{ color: t.fg, opacity: 0.85 }}>
            {message}
          </ThemedText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  icon: { marginTop: 1 },
  text: { flex: 1, gap: 2 },
});
