import { router, useScrollToTop } from 'expo-router';
import { BottomTabBarHeightContext } from 'expo-router/tabs';
import { useContext, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewInstance, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Path, Pattern, Rect } from 'react-native-svg';
import { useAccount } from '@/lib/account';
import { useNotifications } from '@/lib/notifications';
import { useProgress } from '@/lib/progress';
import { Avatar, Icon, PressBlock } from './kit';
import { colors, fonts } from './theme';

/** The web's 32px graph-paper background. */
function GridBackground() {
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <Pattern id="grid" width={32} height={32} patternUnits="userSpaceOnUse">
          <Path d="M32 0H0V32" stroke={colors.grid} strokeWidth={1} fill="none" />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#grid)" />
    </Svg>
  );
}

/**
 * A screen: a fixed top bar, the scrolling content, and an optional sticky action bar at the bottom
 * (the main action stays under the thumb). In a tab, tapping the active tab scrolls back to the top.
 */
export function Screen({
  children,
  header,
  footer,
  contentStyle,
  refreshing,
  onRefresh,
  scrollRef,
}: {
  children: ReactNode;
  header?: ReactNode;
  /** Sticky bottom actions (main CTA). */
  footer?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  refreshing?: boolean;
  onRefresh?: () => void;
  scrollRef?: RefObject<ScrollViewInstance | null>;
}) {
  const insets = useSafeAreaInsets();
  // Inside the tabs the tab bar already covers the home indicator.
  const inTabs = useContext(BottomTabBarHeightContext) !== undefined;
  const ownRef = useRef<ScrollViewInstance>(null);
  const ref = scrollRef ?? ownRef;
  useScrollToTop(ref as RefObject<ScrollViewInstance>);
  const [scrolled, setScrolled] = useState(false);
  const bottomInset = inTabs ? 0 : insets.bottom;
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = event.nativeEvent.contentOffset.y > 4;
    if (next !== scrolled) setScrolled(next);
  };
  return (
    // The status bar area and the top bar sit outside the ScrollView, so content scrolls under neither.
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <GridBackground />
      {header && <View style={[styles.top, scrolled && styles.topScrolled]}>{header}</View>}
      <ScrollView
        ref={ref}
        onScroll={onScroll}
        scrollEventThrottle={32}
        contentContainerStyle={[styles.content, { paddingBottom: (footer ? 24 : bottomInset + 40) }, contentStyle]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
        refreshControl={onRefresh ? <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={colors.ink} /> : undefined}
      >
        {children}
      </ScrollView>
      {footer && <View style={[styles.footer, { paddingBottom: Math.max(bottomInset, 14) }]}>{footer}</View>}
    </View>
  );
}

/** Brand, Streak, notifications and the account button (web .knowledge-nav). */
export function AppHeader() {
  const { status, me, ready, openSignIn } = useAccount();
  const { streak } = useProgress();
  const { unread } = useNotifications();
  return (
    <View style={styles.header}>
      <Pressable accessibilityRole="link" accessibilityLabel="KNO home" onPress={() => router.navigate('/')} style={styles.brand}>
        <View style={styles.brandMark}>
          <View style={styles.brandShadow} />
          <View style={styles.brandFace}>
            <Text style={styles.brandQ}>?</Text>
          </View>
        </View>
        <Text style={styles.wordmark}>
          KNO<Text style={{ color: colors.blue }}>.</Text>
        </Text>
      </Pressable>
      <View style={styles.headerEnd}>
        <View style={[styles.streak, streak.current > 0 && styles.streakOn]} accessibilityLabel={`${streak.current} day streak`}>
          <Text style={[styles.flame, streak.current === 0 && { opacity: 0.35 }]}>🔥</Text>
          <Text style={styles.streakNumber}>{streak.current}</Text>
        </View>
        {ready && (
          <PressBlock
            offset={3}
            radius={12}
            onPress={() => router.push('/notifications')}
            accessibilityLabel={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
            style={styles.bell}
          >
            <Icon name="bell" size={20} />
            {unread > 0 && (
              <View style={styles.bellCount}>
                <Text style={styles.bellCountText}>{unread > 9 ? '9+' : unread}</Text>
              </View>
            )}
          </PressBlock>
        )}
        {ready && me ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Your profile" onPress={() => router.navigate('/profile')}>
            <Avatar id={me.avatar} size="md" />
          </Pressable>
        ) : (
          <PressBlock
            offset={3}
            radius={12}
            color={colors.yellow}
            disabled={status === 'loading'}
            onPress={() => openSignIn(status === 'signedIn' ? 'profile' : 'signIn')}
            style={styles.signIn}
          >
            <Text style={styles.signInText}>{status === 'signedIn' ? 'Finish profile' : 'Sign in'}</Text>
          </PressBlock>
        )}
      </View>
    </View>
  );
}

/** Top bar for pushed screens: back button and a small title. */
export function BackBar({ title, onBack, right }: { title?: string; onBack?: () => void; right?: ReactNode }) {
  return (
    <View style={styles.backBar}>
      <PressBlock offset={3} radius={12} onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))} accessibilityLabel="Back" style={styles.backButton}>
        <Icon name="back" size={20} />
      </PressBlock>
      {title ? (
        <Text style={styles.backTitle} numberOfLines={1}>
          {title}
        </Text>
      ) : (
        <View style={{ flex: 1 }} />
      )}
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  content: { paddingHorizontal: 18, paddingTop: 16, gap: 22 },
  top: { paddingHorizontal: 18, paddingTop: 6, paddingBottom: 10, backgroundColor: colors.paper, zIndex: 2 },
  topScrolled: { borderBottomWidth: 2, borderBottomColor: colors.ink },
  footer: { gap: 10, paddingHorizontal: 18, paddingTop: 14, borderTopWidth: 3, borderTopColor: colors.ink, backgroundColor: colors.paper },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: { width: 42, height: 42, transform: [{ rotate: '-5deg' }] },
  brandShadow: { position: 'absolute', left: 3, top: 3, width: 38, height: 38, borderRadius: 11, backgroundColor: colors.ink },
  brandFace: { width: 38, height: 38, borderRadius: 11, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.yellow, alignItems: 'center', justifyContent: 'center' },
  brandQ: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  wordmark: { fontFamily: fonts.display, fontSize: 24, letterSpacing: -1.4, color: colors.ink },
  headerEnd: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 40, paddingHorizontal: 11, borderWidth: 2, borderColor: colors.ink, borderRadius: 999, backgroundColor: colors.white },
  streakOn: { backgroundColor: colors.cream },
  flame: { fontSize: 16 },
  streakNumber: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },
  bell: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  bellCount: { position: 'absolute', top: -8, right: -8, minWidth: 20, height: 20, paddingHorizontal: 4, borderRadius: 10, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.coral, alignItems: 'center', justifyContent: 'center' },
  bellCountText: { fontFamily: fonts.bodyBlack, fontSize: 10, color: colors.ink },
  signIn: { height: 40, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  signInText: { fontFamily: fonts.bodyHeavy, fontSize: 14, color: colors.ink },
  backBar: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backTitle: { flex: 1, fontFamily: fonts.bodyBlack, fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.ink },
});
