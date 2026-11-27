import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { UsernameSchema, type Friend, type FriendRequest, type FriendsResponse } from '@/contracts';
import { nameWithTitle, useAccount } from '@/lib/account';
import { ApiProblemError, acceptFriendRequest, dismissFriendRequest, fetchFriends, nudgeFriend, removeFriend, sendFriendRequest } from '@/lib/api';
import { useProgress } from '@/lib/progress';
import { friendLink, nudgeLink, shareText } from '@/lib/share';
import { BackBar, Screen } from '@/ui/Screen';
import { Avatar, Block, Body, Button, Chip, Display, ErrorText, Field, Kicker, Note, PageTitle } from '@/ui/kit';
import { colors, fonts } from '@/ui/theme';

type State = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: FriendsResponse };

const SEND_ERRORS: Record<string, string> = {
  'social.playerNotFound': 'No player with that Username.',
  'social.self': "That's you!",
  'social.alreadyFriends': "You're already Friends.",
  'social.profileIncomplete': 'Finish your profile first.',
  rateLimited: "You've sent a lot of Friend Requests. Try again later.",
};

function RequestRow({ request, incoming, busy, onAccept, onDismiss }: { request: FriendRequest; incoming: boolean; busy: boolean; onAccept: () => void; onDismiss: () => void }) {
  const name = request.player.username;
  return (
    <Block offset={4} radius={16} style={styles.row}>
      <Avatar id={request.player.avatar} />
      <View style={styles.rowName}>
        <Text style={styles.rowUser} numberOfLines={1}>
          {nameWithTitle(name, request.player.title)}
        </Text>
        <Text style={styles.rowSub}>{incoming ? 'wants to be Friends' : 'Request sent'}</Text>
      </View>
      <View style={styles.rowActions}>
        {incoming && <Button size="sm" label="Accept" disabled={busy} onPress={onAccept} accessibilityLabel={`Accept ${name}`} />}
        <Button size="sm" tone="white" label={incoming ? 'Decline' : 'Cancel'} disabled={busy} onPress={onDismiss} accessibilityLabel={incoming ? `Decline ${name}` : `Cancel request to ${name}`} />
      </View>
    </Block>
  );
}

function FriendRow({ friend, busy, onRemove, onNudge }: { friend: Friend; busy: boolean; onRemove: () => void; onNudge: () => void }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <Block offset={4} radius={16} style={styles.friend}>
      <View style={styles.friendTop}>
        <Avatar id={friend.avatar} />
        <View style={styles.rowName}>
          <Text style={styles.rowUser} numberOfLines={1}>
            {nameWithTitle(friend.username, friend.title)}
          </Text>
          <View style={styles.status}>
            <Chip label={`⚡ ${friend.streak}`} color={colors.lime} />
            <Chip label={friend.playedToday ? '✓ Played today' : 'Not yet today'} color={friend.playedToday ? colors.mint : colors.white} dashed={!friend.playedToday} />
          </View>
        </View>
      </View>
      <View style={styles.friendActions}>
        {!confirming && friend.canNudge && <Button size="sm" label="👋 Nudge" disabled={busy} onPress={onNudge} accessibilityLabel={`Nudge ${friend.username}`} />}
        {!confirming && !friend.playedToday && friend.nudged && <Chip label="Nudged ✓" color={colors.sky} />}
        {confirming ? (
          <>
            <Button size="sm" tone="coral" label="Remove" disabled={busy} onPress={onRemove} accessibilityLabel={`Confirm removing ${friend.username}`} />
            <Button size="sm" tone="white" label="Keep" onPress={() => setConfirming(false)} />
          </>
        ) : (
          <Button size="sm" tone="white" label="⋯" onPress={() => setConfirming(true)} accessibilityLabel={`Remove ${friend.username}`} />
        )}
      </View>
    </Block>
  );
}

/** Friends (FR-21–FR-23): add by Username or friend link, requests, Friends and Nudges. */
export default function FriendsScreen() {
  const { ready, requireSignIn } = useAccount();
  const { today } = useProgress();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [username, setUsername] = useState('');
  const [note, setNote] = useState<{ text: string; error: boolean } | null>(null);

  useEffect(() => {
    if (!ready) return;
    let live = true;
    fetchFriends(today).then(
      (data) => live && setState({ status: 'ready', data }),
      () => live && setState({ status: 'error' }),
    );
    return () => {
      live = false;
    };
  }, [ready, today, attempt]);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);

  const act = async (action: () => Promise<unknown>, failure: string) => {
    setBusy(true);
    setNote(null);
    try {
      await action();
      reload();
    } catch {
      setNote({ text: failure, error: true });
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    const parsed = UsernameSchema.safeParse(username);
    if (!parsed.success) {
      setNote({ text: parsed.error.issues[0]?.message ?? 'Check the Username.', error: true });
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      const result = await sendFriendRequest({ username: parsed.data });
      setUsername('');
      setNote({ text: result.status === 'friends' ? `You and ${result.player.username} are now Friends.` : `Friend Request sent to ${result.player.username}.`, error: false });
      reload();
    } catch (caught) {
      const code = caught instanceof ApiProblemError ? caught.code : undefined;
      setNote({ text: (code && SEND_ERRORS[code]) ?? "Couldn't send the request. Try again.", error: true });
    } finally {
      setBusy(false);
    }
  };

  const nudge = async (friend: Friend) => {
    setBusy(true);
    setNote(null);
    try {
      await nudgeFriend(friend.id, today);
      setNote({ text: `Nudged ${friend.username}.`, error: false });
    } catch (caught) {
      const code = caught instanceof ApiProblemError ? caught.code : undefined;
      setNote({
        text:
          code === 'social.alreadyPlayed'
            ? `${friend.username} already played today.`
            : code === 'social.alreadyNudged'
              ? `You already nudged ${friend.username} today.`
              : code === 'rateLimited'
                ? "You've sent a lot of Nudges. Try again later."
                : "Couldn't nudge. Try again.",
        error: true,
      });
    } finally {
      setBusy(false);
      reload();
    }
  };

  const share = (which: 'friend' | 'nudge') => {
    if (state.status !== 'ready') return;
    const token = state.data.linkToken;
    void shareText(which === 'friend' ? `Add me on KNO.: ${friendLink(token)}` : `Today's KNO. question is waiting: ${nudgeLink(token)}`);
  };

  if (!ready) {
    return (
      <Screen header={<BackBar title="Friends" />}>
        <Note action={{ label: 'Sign in', onPress: () => requireSignIn('/friends') }}>Sign in to add Friends and see who played today.</Note>
      </Screen>
    );
  }

  return (
    <Screen header={<BackBar title="Friends" />} onRefresh={reload}>
      <View style={styles.intro}>
        <Kicker>Play together</Kicker>
        <PageTitle>Friends</PageTitle>
        <Body>See who played today's question, nudge the ones who haven't, and start a quiz night.</Body>
      </View>
      <Block offset={7} radius={22} border={3} style={styles.add}>
        <Display style={styles.addTitle}>Add a Friend</Display>
        <Field label="Username" placeholder="Their Username" autoCapitalize="none" autoCorrect={false} value={username} onChangeText={setUsername} onSubmitEditing={() => void submit()} />
        <Button label="Send request" disabled={busy || !username.trim()} onPress={() => void submit()} />
        <View style={styles.linkBox}>
          <Body style={styles.linkText}>Or share your friend link — whoever opens it can add you.</Body>
          <Button label="Share friend link" tone="white" size="sm" icon="share" disabled={state.status !== 'ready'} onPress={() => share('friend')} />
        </View>
        <View style={styles.linkBox}>
          <Body style={styles.linkText}>Nudge anyone, anywhere: your Nudge Link opens today's question and says it's from you.</Body>
          <Button label="Share Nudge Link" tone="white" size="sm" icon="share" disabled={state.status !== 'ready'} onPress={() => share('nudge')} />
        </View>
        {note && (note.error ? <ErrorText>{note.text}</ErrorText> : <Note tone="success">{note.text}</Note>)}
      </Block>
      {state.status === 'loading' && <Note>Loading your Friends…</Note>}
      {state.status === 'error' && (
        <Note tone="error" action={{ label: 'Try again', onPress: reload }}>
          Couldn't load your Friends.
        </Note>
      )}
      {state.status === 'ready' && (
        <>
          {state.data.incoming.length > 0 && (
            <View style={styles.section}>
              <Display style={styles.sectionTitle}>Friend Requests</Display>
              {state.data.incoming.map((request) => (
                <RequestRow
                  key={request.id}
                  request={request}
                  incoming
                  busy={busy}
                  onAccept={() => void act(() => acceptFriendRequest(request.id), "Couldn't accept. Try again.")}
                  onDismiss={() => void act(() => dismissFriendRequest(request.id), "Couldn't decline. Try again.")}
                />
              ))}
            </View>
          )}
          <View style={styles.section}>
            <Display style={styles.sectionTitle}>Your Friends</Display>
            {state.data.friends.length === 0 ? (
              <Note>No Friends yet. Add someone by Username or share your link.</Note>
            ) : (
              state.data.friends.map((friend) => (
                <FriendRow key={friend.id} friend={friend} busy={busy} onNudge={() => void nudge(friend)} onRemove={() => void act(() => removeFriend(friend.id), "Couldn't remove. Try again.")} />
              ))
            )}
          </View>
          {state.data.outgoing.length > 0 && (
            <View style={styles.section}>
              <Display style={styles.sectionTitle}>Sent requests</Display>
              {state.data.outgoing.map((request) => (
                <RequestRow key={request.id} request={request} incoming={false} busy={busy} onAccept={() => {}} onDismiss={() => void act(() => dismissFriendRequest(request.id), "Couldn't cancel. Try again.")} />
              ))}
            </View>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { gap: 12, alignItems: 'flex-start' },
  add: { padding: 18, gap: 12 },
  addTitle: { fontSize: 24, letterSpacing: -1 },
  linkBox: { gap: 8, paddingTop: 12, borderTopWidth: 2, borderTopColor: colors.faint, alignItems: 'flex-start' },
  linkText: { fontSize: 14, lineHeight: 20 },
  section: { gap: 10 },
  sectionTitle: { fontSize: 26, letterSpacing: -1.2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  rowName: { flex: 1, gap: 6 },
  rowUser: { fontFamily: fonts.display, fontSize: 17, color: colors.ink },
  rowSub: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.muted },
  rowActions: { gap: 4 },
  friend: { padding: 12, gap: 12 },
  friendTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  status: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  friendActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, justifyContent: 'flex-end' },
});
