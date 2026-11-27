import { type BottomTabBarProps, Tabs } from 'expo-router/tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { haptics } from '@/lib/haptics';
import { Icon, type IconName } from '@/ui/kit';
import { colors, fonts } from '@/ui/theme';

const TABS: { name: string; label: string; icon: IconName }[] = [
  { name: 'index', label: 'Today', icon: 'today' },
  { name: 'quizzes', label: 'Quizzes', icon: 'quizzes' },
  { name: 'library', label: 'Library', icon: 'library' },
  { name: 'profile', label: 'Profile', icon: 'profile' },
];

/** The web's nav as a bottom bar; the active tab is a yellow sticker. */
function TabBar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]} accessibilityRole="tablist">
      {state.routes.map((route, index) => {
        const tab = TABS.find((item) => item.name === route.name);
        if (!tab) return null;
        const focused = state.index === index;
        const onPress = () => {
          const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) {
            haptics.select();
            navigateToTab(route.key);
          }
        };
        return (
          <Pressable key={route.key} onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel={tab.label} style={styles.tab}>
            <View style={[styles.pill, focused && styles.pillOn]}>
              {focused && <View style={styles.pillShadow} />}
              <View style={[styles.pillFace, focused && styles.pillFaceOn]}>
                <Icon name={tab.icon} size={21} strokeWidth={focused ? 2.4 : 2} />
              </View>
            </View>
            <Text style={[styles.label, focused && styles.labelOn]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      {TABS.map((tab) => (
        <Tabs.Screen key={tab.name} name={tab.name} options={{ title: tab.label }} />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', paddingTop: 10, paddingHorizontal: 8, borderTopWidth: 3, borderTopColor: colors.ink, backgroundColor: colors.white },
  tab: { flex: 1, alignItems: 'center', gap: 5 },
  pill: { width: 52, height: 36 },
  pillOn: {},
  pillShadow: { position: 'absolute', left: 3, top: 3, width: 49, height: 33, borderRadius: 11, backgroundColor: colors.ink },
  pillFace: { width: 49, height: 33, borderRadius: 11, borderWidth: 2, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  pillFaceOn: { borderColor: colors.ink, backgroundColor: colors.yellow },
  label: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.muted },
  labelOn: { fontFamily: fonts.bodyBlack, color: colors.ink },
});
