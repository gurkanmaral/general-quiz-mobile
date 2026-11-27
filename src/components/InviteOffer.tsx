import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { LinkOwnerResponse } from '@/contracts';
import { useAccount } from '@/lib/account';
import { ApiProblemError, fetchLinkOwner, sendFriendRequest } from '@/lib/api';
import { BackBar, Screen } from '@/ui/Screen';
import { Avatar, Block, Body, Button, Display, Kicker, Note } from '@/ui/kit';
import { colors } from '@/ui/theme';

type Owner = LinkOwnerResponse['player'];

/** A friend link or Nudge Link opened in the app (FR-21, FR-25): who sent it, and a Friend Request. */
export function InviteOffer({ kind, token }: { kind: 'friend' | 'nudge'; token: string }) {
  const { status, me, ready, requireSignIn } = useAccount();
  const [owner, setOwner] = useState<Owner | null>(null);
  const [connected, setConnected] = useState(false);
  const [dead, setDead] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const returnTo = `/${kind === 'friend' ? 'f' : 'n'}/${token}`;

  useEffect(() => {
    let live = true;
    fetchLinkOwner(token).then(
      (response) => {
        if (!live) return;
        setOwner(response.player);
        setConnected(response.connected);
      },
      (caught: unknown) => live && caught instanceof ApiProblemError && caught.status === 404 && setDead(true),
    );
    return () => {
      live = false;
    };
  }, [token, status]);

  const self = ready && owner && me?.username?.toLowerCase() === owner.username.toLowerCase();
  const add = async () => {
    if (!owner || !requireSignIn(returnTo)) return;
    setBusy(true);
    try {
      const result = await sendFriendRequest({ token });
      setDone(result.status === 'friends' ? `You and ${owner.username} are now Friends.` : `Friend Request sent to ${owner.username}.`);
    } catch (caught) {
      setDone(caught instanceof ApiProblemError && caught.code === 'social.alreadyFriends' ? `You and ${owner.username} are already Friends.` : "Couldn't send the Friend Request. Try again from Friends.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen header={<BackBar title={kind === 'friend' ? 'Friend link' : 'Nudge'} onBack={() => router.replace('/')} />}>
      {dead && <Note tone="error">This link no longer works.</Note>}
      {!dead && !owner && <Note>Opening the link…</Note>}
      {owner && (
        <Block offset={8} radius={24} border={3} color={kind === 'nudge' ? colors.yellow : colors.sky} style={styles.card}>
          <Kicker color={colors.white}>{kind === 'nudge' ? 'You got nudged' : 'Friend link'}</Kicker>
          <View style={styles.owner}>
            <Avatar id={owner.avatar} size="xl" />
            <Display style={styles.title}>{kind === 'nudge' ? `${owner.username} nudged you: today's question is waiting!` : `${owner.username} shared their friend link.`}</Display>
          </View>
          {done ? (
            <Note tone="success">{done}</Note>
          ) : self ? (
            <Body>That's your own link — share it with friends.</Body>
          ) : ready && connected ? (
            <Body>You and {owner.username} are already Friends.</Body>
          ) : (
            <Button label={ready ? 'Send Friend Request' : `Sign in to add ${owner.username}`} tone="ink" size="lg" busy={busy} onPress={() => void add()} />
          )}
          {kind === 'nudge' && <Button label="Play today's question" tone="white" icon="arrow" onPress={() => router.replace('/')} />}
        </Block>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { padding: 20, gap: 16 },
  owner: { gap: 14 },
  title: { fontSize: 28, lineHeight: 31, letterSpacing: -1.3 },
});
