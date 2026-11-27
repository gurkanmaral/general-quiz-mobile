import { Tabs } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '@/ui/kit';
import { colors, fonts } from '@/ui/theme';

const TABS: { name: string; label: string; number: string; icon: IconName }[] = [
  { name: 'index', label: 'Today', number: '01', icon: 'today' },
  { name: 'quizzes', label: 'Quizzes', number: '02', icon: 'quizzes' },
  { name: 'library', label: 'Library', number: '03', icon: 'library' },
  { name: 'profile', label: 'Profile', number: '04', icon: 'profile' },
];

type TabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: { navigate: (name: string) => void; emit: (event: { type: 'tabPress'; target: string; canPreventDefault: true }) => { defaultPrevented: boolean } };
};

/** The web's numbered nav as a bottom bar; the active tab is a yellow sticker. */
function TabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]} accessibilityRole="tablist">
      {state.routes.map((route, index) => {
        const tab = TABS.find((item) => item.name === route.name);
        if (!tab) return null;
        const focused = state.index === index;
        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        };
        return (
          <Pressable key={route.key} onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel={tab.label} style={styles.tab}>
            <View style={[styles.pill, focused && styles.pillOn]}>
              {focused && <View style={styles.pillShadow} />}
              <View style={[styles.pillFace, focused && styles.pillFaceOn]}>
                <Icon name={tab.icon} size={21} strokeWidth={focused ? 2.4 : 2} />
              </View>
            </View>
            <Text style={[styles.label, focused && styles.labelOn]}>
              <Text style={styles.number}>{tab.number} </Text>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...(props as unknown as TabBarProps)} />}>
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
  number: { fontSize: 9, color: colors.faint },
});
