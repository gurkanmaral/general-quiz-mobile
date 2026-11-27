import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type TextProps, type TextStyle, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { AvatarId } from '@/contracts';
import { colors, fonts } from './theme';

// ---------------------------------------------------------------------------------------------
// Text

type TxtProps = TextProps & { style?: StyleProp<TextStyle>; children?: ReactNode };

export function Display({ style, ...props }: TxtProps) {
  return <Text {...props} style={[styles.display, style]} />;
}

export function Body({ style, ...props }: TxtProps) {
  return <Text {...props} style={[styles.body, style]} />;
}

export function Strong({ style, ...props }: TxtProps) {
  return <Text {...props} style={[styles.strong, style]} />;
}

/** Small uppercase tracked label (web: dt, legend, eyebrow). */
export function Label({ style, ...props }: TxtProps) {
  return <Text {...props} style={[styles.label, style]} />;
}

/** The yellow sticker above a title (web .knowledge-kicker). */
export function Kicker({ children, color = colors.yellow }: { children: ReactNode; color?: string }) {
  return (
    <Block offset={3} radius={8} color={color} style={styles.kickerFace}>
      <Text style={styles.kickerText}>{children}</Text>
    </Block>
  );
}

/** A big page title ending in a blue full stop: "Quizzes." */
export function PageTitle({ children, size = 52 }: { children: ReactNode; size?: number }) {
  return (
    <Display style={{ fontSize: size, lineHeight: size * 0.95, letterSpacing: -size * 0.06 }}>
      {children}
      <Text style={{ color: colors.blue }}>.</Text>
    </Display>
  );
}

// ---------------------------------------------------------------------------------------------
// Blocks with the hard offset shadow (drawn as a solid ink layer: works on iOS and Android alike)

type BlockProps = {
  children?: ReactNode;
  offset?: number;
  /** Shadow only below (web "0 5px 0"), instead of down-right. */
  down?: boolean;
  radius?: number;
  color?: string;
  border?: number;
  dashed?: boolean;
  style?: StyleProp<ViewStyle>;
  outerStyle?: StyleProp<ViewStyle>;
};

export function Block({ children, offset = 5, down = false, radius = 18, color = colors.white, border = 2, dashed = false, style, outerStyle }: BlockProps) {
  const dx = down ? 0 : offset;
  return (
    <View style={[{ marginRight: dx, marginBottom: offset }, outerStyle]}>
      {offset > 0 && <View pointerEvents="none" style={[styles.shadow, { left: dx, top: offset, right: -dx, bottom: -offset, borderRadius: radius }]} />}
      <View style={[{ borderWidth: border, borderColor: colors.ink, borderStyle: dashed ? 'dashed' : 'solid', borderRadius: radius, backgroundColor: color, overflow: 'hidden' }, style]}>{children}</View>
    </View>
  );
}

/** A pressable block that sinks into its shadow when pressed (web :active). */
export function PressBlock({
  children,
  onPress,
  disabled,
  offset = 5,
  down = true,
  radius = 14,
  color = colors.white,
  border = 2,
  style,
  outerStyle,
  accessibilityLabel,
  accessibilityRole = 'button',
  accessibilityState,
  testID,
}: BlockProps & {
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'radio' | 'link' | 'tab' | 'switch';
  accessibilityState?: { selected?: boolean; checked?: boolean; disabled?: boolean };
  testID?: string;
}) {
  const dx = down ? 0 : offset;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, ...accessibilityState }}
      testID={testID}
      style={[{ marginRight: dx, marginBottom: offset, opacity: disabled ? 0.5 : 1 }, outerStyle]}
    >
      {({ pressed }) => (
        <>
          {offset > 0 && <View pointerEvents="none" style={[styles.shadow, { left: dx, top: offset, right: -dx, bottom: -offset, borderRadius: radius }]} />}
          <View
            style={[
              { borderWidth: border, borderColor: colors.ink, borderRadius: radius, backgroundColor: color },
              pressed && !disabled && { transform: [{ translateX: dx }, { translateY: offset }] },
              style,
            ]}
          >
            {children}
          </View>
        </>
      )}
    </Pressable>
  );
}

type ButtonTone = 'yellow' | 'ink' | 'lime' | 'white' | 'coral' | 'sky';
const TONES: Record<ButtonTone, { bg: string; fg: string }> = {
  yellow: { bg: colors.yellow, fg: colors.ink },
  ink: { bg: colors.ink, fg: colors.white },
  lime: { bg: colors.lime, fg: colors.ink },
  white: { bg: colors.white, fg: colors.ink },
  coral: { bg: colors.coral, fg: colors.ink },
  sky: { bg: colors.sky, fg: colors.ink },
};

export function Button({
  label,
  onPress,
  tone = 'yellow',
  size = 'md',
  disabled,
  busy,
  icon,
  style,
  accessibilityLabel,
  testID,
}: {
  label: string;
  onPress?: () => void;
  tone?: ButtonTone;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  busy?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
}) {
  const { bg, fg } = TONES[tone];
  const height = size === 'lg' ? 60 : size === 'md' ? 52 : 40;
  const fontSize = size === 'lg' ? 20 : size === 'md' ? 16 : 13;
  return (
    <PressBlock
      onPress={onPress}
      disabled={disabled || busy}
      color={bg}
      offset={size === 'sm' ? 3 : size === 'md' ? 5 : 6}
      radius={size === 'sm' ? 11 : 14}
      border={size === 'sm' ? 2 : 3}
      outerStyle={style}
      accessibilityLabel={accessibilityLabel ?? label}
      testID={testID}
      style={[styles.buttonFace, { minHeight: height, paddingHorizontal: size === 'sm' ? 12 : 20 }]}
    >
      {busy ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          <Text style={[size === 'lg' ? styles.buttonTextLg : styles.buttonText, { color: fg, fontSize }]}>{label}</Text>
          {icon && <Icon name={icon} size={fontSize + 2} color={fg} />}
        </>
      )}
    </PressBlock>
  );
}

/** A plain text action (web .kno-sheet-link). */
export function LinkButton({ label, onPress, color = colors.blue, disabled }: { label: string; onPress: () => void; color?: string; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" hitSlop={8} style={{ opacity: disabled ? 0.5 : 1 }}>
      {({ pressed }) => <Text style={[styles.link, { color, opacity: pressed ? 0.6 : 1 }]}>{label}</Text>}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------------------------
// Chips, notes, fields

export function Chip({ label, color = colors.white, dashed = false, textColor = colors.ink, style }: { label: string; color?: string; dashed?: boolean; textColor?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.chip, { backgroundColor: color, borderStyle: dashed ? 'dashed' : 'solid' }, style]}>
      <Text style={[styles.chipText, { color: textColor }]}>{label}</Text>
    </View>
  );
}

/** A dashed note box (web .kno-page-note). */
export function Note({ children, tone = 'plain', action }: { children: ReactNode; tone?: 'plain' | 'error' | 'success'; action?: { label: string; onPress: () => void } }) {
  const bg = tone === 'error' ? colors.blush : tone === 'success' ? colors.mint : 'transparent';
  return (
    <View style={[styles.note, { backgroundColor: bg, borderStyle: tone === 'plain' ? 'dashed' : 'solid' }]} accessibilityRole={tone === 'error' ? 'alert' : undefined}>
      <Text style={styles.noteText}>{children}</Text>
      {action && <LinkButton label={action.label} onPress={action.onPress} />}
    </View>
  );
}

export function Field({ label, hint, style, ...props }: TextInputProps & { label: string; hint?: string }) {
  return (
    <View style={styles.field}>
      <Label>{label}</Label>
      <TextInput placeholderTextColor={colors.faint} {...props} accessibilityLabel={label} style={[styles.input, style]} />
      {hint && <Body style={styles.hint}>{hint}</Body>}
    </View>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  return (
    <Text accessibilityRole="alert" style={styles.error}>
      {children}
    </Text>
  );
}

// ---------------------------------------------------------------------------------------------
// Avatar

export const AVATARS: Record<AvatarId, { emoji: string; label: string; color: string }> = {
  owl: { emoji: '🦉', label: 'Story Owl', color: colors.yellow },
  scout: { emoji: '🧭', label: 'Scout', color: colors.sky },
  fox: { emoji: '🦊', label: 'Fox', color: colors.coral },
  robot: { emoji: '🤖', label: 'Robot', color: colors.lime },
  cat: { emoji: '🐱', label: 'Cat', color: '#ffd8d0' },
  octopus: { emoji: '🐙', label: 'Octopus', color: '#dbe1ff' },
  rocket: { emoji: '🚀', label: 'Rocket', color: '#fff0a9' },
  cactus: { emoji: '🌵', label: 'Cactus', color: '#ecfbc4' },
};

const AVATAR_SIZES = { sm: 30, md: 42, lg: 56, xl: 84 } as const;

export function Avatar({ id, size = 'md', faded = false }: { id: AvatarId | null; size?: keyof typeof AVATAR_SIZES; faded?: boolean }) {
  const avatar = id ? AVATARS[id] : undefined;
  const side = AVATAR_SIZES[size];
  const shadow = size === 'sm' ? 2 : size === 'xl' ? 4 : 3;
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: side + shadow, height: side + shadow, opacity: faded ? 0.5 : 1 }}>
      <View style={[styles.shadow, { left: shadow, top: shadow, width: side, height: side, borderRadius: side * 0.27 }]} />
      <View style={[styles.avatar, { width: side, height: side, borderRadius: side * 0.27, backgroundColor: avatar?.color ?? colors.white }]}>
        <Text style={{ fontSize: side * 0.55, lineHeight: side * 0.72 }}>{avatar?.emoji ?? '?'}</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
// Icons (stroke paths, the same shapes as the web's inline SVGs)

export type IconName = 'arrow' | 'down' | 'play' | 'bell' | 'today' | 'quizzes' | 'library' | 'profile' | 'close' | 'back' | 'share' | 'check';

const PATHS: Record<IconName, string> = {
  arrow: 'M4 10h11M11 6l4 4-4 4',
  down: 'M10 4v11M6 11l4 4 4-4',
  play: 'm7 5 9 5-9 5V5Z',
  bell: 'M5 14V9a5 5 0 1 1 10 0v5l1.6 1.6H3.4L5 14ZM8.3 17.5h3.4',
  today: 'M4 5h12v11H4zM4 8.5h12M7.5 3v3.5M12.5 3v3.5',
  quizzes: 'M3.5 3.5h5.5v5.5H3.5zM11 3.5h5.5v5.5H11zM3.5 11h5.5v5.5H3.5zM11 11h5.5v5.5H11z',
  library: 'M4 4h3v12H4zM8.5 4h3v12h-3zM13 4.6l2.8-.8 2.4 11.4-2.8.8z',
  profile: 'M10 10a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4ZM4 16.5c.8-3 3.2-4.5 6-4.5s5.2 1.5 6 4.5',
  close: 'M5 5l10 10M15 5 5 15',
  back: 'M16 10H5M9 6l-4 4 4 4',
  share: 'M10 3v10M6 7l4-4 4 4M4 12v4h12v-4',
  check: 'm4 10.5 4 4 8-9',
};

export function Icon({ name, size = 20, color = colors.ink, strokeWidth = 2.2 }: { name: IconName; size?: number; color?: string; strokeWidth?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none" accessibilityElementsHidden importantForAccessibility="no">
      <Path d={PATHS[name]} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill={name === 'play' ? color : 'none'} />
    </Svg>
  );
}

// ---------------------------------------------------------------------------------------------

const styles = StyleSheet.create({
  display: { fontFamily: fonts.display, color: colors.ink, letterSpacing: -0.6 },
  body: { fontFamily: fonts.body, color: colors.ink, fontSize: 15, lineHeight: 22 },
  strong: { fontFamily: fonts.bodyHeavy, color: colors.ink, fontSize: 15 },
  label: { fontFamily: fonts.bodyBlack, color: colors.ink, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' },
  kickerFace: { paddingHorizontal: 11, paddingVertical: 6 },
  kickerText: { fontFamily: fonts.bodyBlack, fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', color: colors.ink },
  shadow: { position: 'absolute', backgroundColor: colors.ink },
  buttonFace: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  buttonText: { fontFamily: fonts.bodyHeavy },
  buttonTextLg: { fontFamily: fonts.display, letterSpacing: -0.4 },
  link: { fontFamily: fonts.bodyHeavy, fontSize: 14, textDecorationLine: 'underline' },
  chip: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1.5, borderColor: colors.ink, borderRadius: 999 },
  chipText: { fontFamily: fonts.bodyBlack, fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase' },
  note: { gap: 8, padding: 14, borderWidth: 2, borderColor: colors.ink, borderRadius: 14 },
  noteText: { fontFamily: fonts.bodyBold, fontSize: 14, lineHeight: 20, color: colors.ink },
  field: { gap: 7 },
  input: { minHeight: 52, paddingHorizontal: 14, borderWidth: 2, borderColor: colors.ink, borderRadius: 12, backgroundColor: colors.white, fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink },
  hint: { fontSize: 13, color: colors.muted },
  error: { fontFamily: fonts.bodyBold, fontSize: 14, lineHeight: 20, color: colors.down },
  avatar: { position: 'absolute', left: 0, top: 0, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.ink },
});
