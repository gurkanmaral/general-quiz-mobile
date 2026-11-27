import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useAccount } from '@/lib/account';
import { notificationTarget, notificationText, timeAgo, useNotifications } from '@/lib/notifications';
import { BackBar, Screen } from '@/ui/Screen';
import { Avatar, Body, Kicker, Note, PageTitle, PressBlock } from '@/ui/kit';
import { colors, fonts } from '@/ui/theme';

/** Notifications (FR-26): Friend Requests, Nudges and Lobby Invites. Opening marks them read. */
export default function NotificationsScreen() {
  const { ready, requireSignIn } = useAccount();
  const { items, openList } = useNotifications();
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (ready) void openList().then((ok) => setFailed(!ok));
  }, [ready, openList]);

  if (!ready) {
    return (
      <Screen header={<BackBar title="Notifications" />}>
        <Note action={{ label: 'Sign in', onPress: () => requireSignIn('/notifications') }}>Sign in to see Friend Requests, Nudges and Lobby Invites.</Note>
      </Screen>
    );
  }

  return (
    <Screen
      header={<BackBar title="Notifications" />}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        void openList().then((ok) => {
          setFailed(!ok);
          setRefreshing(false);
        });
      }}
    >
      <View style={styles.intro}>
        <Kicker>What's new</Kicker>
        <PageTitle>Notifications</PageTitle>
      </View>
      {failed && <Note tone="error">Couldn't load notifications.</Note>}
      {items && items.length === 0 && <Note>Nothing yet. Friend Requests, Nudges and Lobby Invites show up here.</Note>}
      {items?.map((item, index) => (
        <Animated.View key={item.id} entering={FadeInDown.delay(index * 40).springify().damping(16)}>
          <PressBlock offset={4} down={false} radius={16} color={item.read ? colors.white : colors.cream} onPress={() => router.push(notificationTarget(item) as Href)} accessibilityRole="link" style={styles.item}>
            <Avatar id={item.actor.avatar} />
            <View style={styles.body}>
              <Body style={styles.text}>{notificationText(item)}</Body>
              <Text style={styles.time}>{timeAgo(item.createdAt)}</Text>
            </View>
            {!item.read && <View style={styles.dot} accessibilityLabel="Unread" />}
          </PressBlock>
        </Animated.View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { gap: 12, alignItems: 'flex-start' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  body: { flex: 1, gap: 3 },
  text: { fontFamily: fonts.bodyBold, fontSize: 15, lineHeight: 21 },
  time: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.muted },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.coral },
});
