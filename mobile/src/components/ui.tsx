import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { avatarColor, colors, fonts, radius } from '@/lib/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Icon({ name, size = 22, color = colors.navy }: { name: IconName; size?: number; color?: string }) {
  return <Ionicons name={name} size={size} color={color} />;
}

// ---- Text ---------------------------------------------------------------------

const DEVANAGARI = /[ऀ-ॿ]/;

type Variant = 'h1' | 'h2' | 'title' | 'body' | 'label' | 'small' | 'caption';
const VARIANT: Record<Variant, TextStyle> = {
  h1: { fontSize: 30, lineHeight: 36, fontFamily: fonts.bold, color: colors.ink },
  h2: { fontSize: 26, lineHeight: 32, fontFamily: fonts.bold, color: colors.ink },
  title: { fontSize: 18, lineHeight: 24, fontFamily: fonts.bold, color: colors.ink },
  body: { fontSize: 17, lineHeight: 24, fontFamily: fonts.regular, color: colors.ink },
  label: { fontSize: 15, lineHeight: 20, fontFamily: fonts.bold, color: colors.muted },
  small: { fontSize: 15, lineHeight: 21, fontFamily: fonts.regular, color: colors.muted },
  caption: { fontSize: 13, lineHeight: 18, fontFamily: fonts.regular, color: colors.muted },
};

/**
 * Text in the app's typeface. Hindi text automatically switches to a
 * Devanagari font, since the Latin typeface has no Hindi letters.
 */
export function Txt({
  variant = 'body',
  style,
  children,
  numberOfLines,
}: {
  variant?: Variant;
  style?: StyleProp<TextStyle>;
  children: ReactNode;
  numberOfLines?: number;
}) {
  let flat: TextStyle = StyleSheet.flatten([VARIANT[variant], style]) ?? {};
  const text = typeof children === 'string' ? children : Array.isArray(children) ? children.join('') : '';
  if (DEVANAGARI.test(text)) {
    const bold = flat.fontFamily === fonts.bold || flat.fontWeight === '700';
    flat = {
      ...flat,
      fontFamily: bold ? fonts.hindiBold : fonts.hindi,
      lineHeight: flat.fontSize ? Math.round(flat.fontSize * 1.5) : undefined,
    };
  }
  return (
    <Text style={flat} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}

// ---- Layout -------------------------------------------------------------------

export function Screen({
  children,
  white,
  scroll = true,
  footer,
  padTop = true,
}: {
  children: ReactNode;
  white?: boolean;
  scroll?: boolean;
  footer?: ReactNode;
  padTop?: boolean;
}) {
  const bg = white ? colors.card : colors.ground;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }} edges={padTop ? ['top', 'left', 'right'] : ['left', 'right']}>
      {/* Shrink the screen above the keyboard so buttons below a field can still be reached. */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView contentContainerStyle={styles.screenContent} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.screenContent, { flex: 1 }]}>{children}</View>
        )}
        {footer}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Row({ children, style, gap = 10 }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Divider() {
  return <View style={{ height: 1, backgroundColor: colors.line }} />;
}

export function Header({ title, onBack, right }: { title: string; onBack?: () => void; right?: ReactNode }) {
  return (
    <Row>
      {onBack ? (
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" style={styles.roundBtn} hitSlop={8}>
          <Icon name="chevron-back" size={24} />
        </Pressable>
      ) : null}
      <Txt variant="h2" style={{ flex: 1 }}>
        {title}
      </Txt>
      {right}
    </Row>
  );
}

// ---- Controls -----------------------------------------------------------------

type ButtonTone = 'primary' | 'gold' | 'outline' | 'danger' | 'ghost' | 'success';
const TONE: Record<ButtonTone, { bg: string; fg: string; border?: string }> = {
  primary: { bg: colors.navy, fg: '#FFFFFF' },
  gold: { bg: colors.marigold, fg: colors.navy },
  outline: { bg: '#FFFFFF', fg: colors.navy, border: colors.navy },
  danger: { bg: colors.red, fg: '#FFFFFF' },
  ghost: { bg: 'transparent', fg: colors.navy },
  success: { bg: colors.tealSoft, fg: colors.teal },
};

export function Button({
  label,
  onPress,
  tone = 'primary',
  icon,
  big,
  loading,
  disabled,
  fontSize,
  style,
}: {
  label: string;
  onPress?: () => void;
  tone?: ButtonTone;
  icon?: IconName;
  big?: boolean;
  loading?: boolean;
  disabled?: boolean;
  fontSize?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const t = TONE[tone];
  const size = fontSize ?? (big ? 21 : 17);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: t.bg,
          minHeight: big ? 68 : 54,
          borderRadius: big ? 20 : radius.md,
          borderWidth: t.border ? 2 : 0,
          borderColor: t.border,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={t.fg} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={size + 5} color={t.fg} /> : null}
          <Txt variant="title" style={{ color: t.fg, fontSize: size, lineHeight: size + 6, textAlign: 'center' }}>
            {label}
          </Txt>
        </>
      )}
    </Pressable>
  );
}

export function Pill({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={[styles.pill, on ? { backgroundColor: colors.navy, borderColor: colors.navy } : null]}
    >
      <Txt variant="body" style={{ fontSize: 15, color: on ? '#FFFFFF' : colors.ink, fontFamily: on ? fonts.bold : fonts.regular }}>
        {label}
      </Txt>
    </Pressable>
  );
}

type ChipTone = 'teal' | 'gold' | 'grey' | 'red';
const CHIP: Record<ChipTone, [string, string]> = {
  teal: [colors.tealSoft, colors.teal],
  gold: [colors.marigoldSoft, colors.brown],
  grey: [colors.greySoft, colors.text2],
  red: [colors.redSoft, '#A3261B'],
};
export function Chip({ label, tone = 'grey', icon }: { label: string; tone?: ChipTone; icon?: IconName }) {
  const [bg, fg] = CHIP[tone];
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      {icon ? <Icon name={icon} size={14} color={fg} /> : null}
      <Txt variant="caption" style={{ color: fg, fontFamily: fonts.bold }}>
        {label}
      </Txt>
    </View>
  );
}

export function Avatar({ initials, seed, size = 48, ring }: { initials: string; seed?: string; size?: number; ring?: boolean }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: ring ? colors.marigoldSoft : avatarColor(seed ?? initials),
        borderWidth: ring ? Math.max(3, size / 26) : 0,
        borderColor: colors.marigold,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Txt variant="title" style={{ color: colors.navy, fontSize: size * 0.36, lineHeight: size * 0.44 }}>
        {initials}
      </Txt>
    </View>
  );
}

export function Field({
  label,
  hint,
  style,
  ...input
}: TextInputProps & { label: string; hint?: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Txt variant="label">{label}</Txt>
      <TextInput
        placeholderTextColor="#8A90A0"
        accessibilityLabel={label}
        {...input}
        style={[styles.input, input.multiline ? { minHeight: 120, textAlignVertical: 'top', paddingTop: 12 } : null, style]}
      />
      {hint ? <Txt variant="caption">{hint}</Txt> : null}
    </View>
  );
}

export function Toggle({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="title" style={{ fontSize: 16 }}>
          {label}
        </Txt>
        {hint ? <Txt variant="small" style={{ fontSize: 14 }}>{hint}</Txt> : null}
      </View>
      <View style={[styles.track, { backgroundColor: value ? colors.teal : colors.lineStrong }]}>
        <View style={[styles.knob, { left: value ? 23 : 3 }]} />
      </View>
    </Pressable>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.error} accessibilityRole="alert">
      <Txt style={{ color: '#7A1A12' }}>{message}</Txt>
      {onRetry ? <Button label="Try again" tone="outline" onPress={onRetry} /> : null}
    </View>
  );
}

export function Loading() {
  return (
    <View style={{ padding: 40, alignItems: 'center' }}>
      <ActivityIndicator size="large" color={colors.navy} />
    </View>
  );
}

export function Banner({ icon, children, tone = 'gold' }: { icon: IconName; children: ReactNode; tone?: 'gold' | 'teal' }) {
  const bg = tone === 'gold' ? colors.marigoldSoft : colors.tealSoft;
  const fg = tone === 'gold' ? colors.brown : colors.teal;
  return (
    <Row style={{ backgroundColor: bg, borderRadius: 18, padding: 16, alignItems: 'flex-start' }} gap={12}>
      <Icon name={icon} color={fg} />
      <View style={{ flex: 1 }}>{children}</View>
    </Row>
  );
}

const styles = StyleSheet.create({
  screenContent: { padding: 20, paddingBottom: 32, gap: 18 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 20, gap: 14 },
  roundBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 18 },
  pill: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.card,
    justifyContent: 'center',
  },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, alignSelf: 'flex-start' },
  input: {
    minHeight: 54,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.lineStrong,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    fontSize: 18,
    fontFamily: fonts.regular,
    color: colors.ink,
  },
  track: { width: 52, height: 32, borderRadius: 16 },
  knob: { position: 'absolute', top: 3, width: 26, height: 26, borderRadius: 13, backgroundColor: '#FFFFFF' },
  error: { backgroundColor: colors.redSoft, borderRadius: 16, padding: 16, gap: 12 },
});
