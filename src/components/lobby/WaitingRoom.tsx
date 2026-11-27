import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FlipInXUp, useAnimatedStyle, useSharedValue, withRepeat, withTiming, ZoomIn } from 'react-native-reanimated';
import {
  LOBBY_COMMANDS,
  LOBBY_MAX_PLAYERS,
  LOBBY_QUESTION_COUNT,
  LOBBY_TIME_LIMIT_S,
  localize,
  type Friend,
  type LobbyState,
  type QuizSummary,
} from '@/contracts';
import { nameWithTitle, useAccount } from '@/lib/account';
import { fetchFriends, fetchQuizzes, inviteToLobby } from '@/lib/api';
import { confirm } from '@/lib/confirm';
import { useProgress } from '@/lib/progress';
import { copyText, lobbyLink, shareText } from '@/lib/share';
import { Avatar, Block, Body, Button, Chip, Display, Icon, Kicker, Label, LinkButton, PressBlock } from '@/ui/kit';
import { colors, fonts } from '@/ui/theme';
import type { Send } from './useLobby';

/** The green Live dot pulses like the web's. */
function LivePill() {
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 1600 }), -1, false);
  }, [pulse]);
  const ring = useAnimatedStyle(() => ({ transform: [{ scale: 1 + pulse.value * 1.6 }], opacity: 0.55 * (1 - pulse.value) }));
  return (
    <View style={styles.live}>
      <View style={styles.liveDotWrap}>
        <Animated.View style={[styles.liveRing, ring]} />
        <View style={styles.liveDot} />
      </View>
      <Text style={styles.liveText}>Live</Text>
    </View>
  );
}

/** The Lobby Code as big letter tiles that flip in one by one. */
function CodeTiles({ code }: { code: string }) {
  return (
    <View style={styles.tiles} accessible accessibilityLabel={`Join code ${code.split('').join(' ')}`}>
      {[...code].map((char, index) => (
        <Animated.View key={`${index}-${char}`} entering={FlipInXUp.delay(index * 70).springify().damping(12)} style={styles.tile}>
          <Text style={styles.tileText}>{char}</Text>
        </Animated.View>
      ))}
    </View>
  );
}

function Segmented({ label, values, current, format, onPick }: { label: string; values: number[]; current: number; format: (value: number) => string; onPick: (value: number) => void }) {
  return (
    <View style={styles.setting}>
      <Label>{label}</Label>
      <View style={styles.segmented} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {values.map((value) => {
          const selected = value === current;
          return (
            <PressBlock
              key={value}
              offset={3}
              radius={11}
              color={selected ? colors.ink : colors.white}
              accessibilityRole="radio"
              accessibilityLabel={format(value)}
              accessibilityState={{ checked: selected }}
              haptic="select"
              onPress={() => !selected && onPick(value)}
              style={styles.segment}
            >
              <Text style={[styles.segmentText, selected && { color: colors.white }]}>{format(value)}</Text>
            </PressBlock>
          );
        })}
      </View>
    </View>
  );
}

function Settings({ state, isHost, send }: { state: LobbyState; isHost: boolean; send: Send }) {
  const [quizzes, setQuizzes] = useState<QuizSummary[]>([]);
  const [picking, setPicking] = useState(false);
  useEffect(() => {
    if (!isHost) return;
    fetchQuizzes().then(
      (body) => setQuizzes(body.quizzes),
      () => {},
    );
  }, [isHost]);
  const inRange = (value: number, range: { min: number; max: number }) => value >= range.min && value <= range.max;
  const counts = [5, 10, 15, 20].filter((value) => inRange(value, LOBBY_QUESTION_COUNT));
  const times = [10, 15, 20, 25, 30].filter((value) => inRange(value, LOBBY_TIME_LIMIT_S));

  if (!isHost) {
    return (
      <View style={styles.settings}>
        <View style={[styles.settingTile, styles.quizTile]}>
          <Label>Quiz</Label>
          <Display style={styles.settingValue}>{localize(state.quiz.title)}</Display>
        </View>
        <View style={styles.settingRow}>
          <View style={[styles.settingTile, styles.half]}>
            <Label>Questions</Label>
            <Display style={styles.settingValue}>{state.settings.questionCount}</Display>
          </View>
          <View style={[styles.settingTile, styles.half]}>
            <Label>Time</Label>
            <Display style={styles.settingValue}>{state.settings.timeLimitS} s</Display>
          </View>
        </View>
      </View>
    );
  }
  return (
    <View style={styles.settings}>
      <View style={[styles.settingTile, styles.quizTile]}>
        <Label>Quiz</Label>
        <PressBlock offset={3} radius={11} onPress={() => setPicking(true)} accessibilityLabel={`Quiz: ${localize(state.quiz.title)}. Change`} style={styles.quizPicker}>
          <Text style={styles.quizPickerText} numberOfLines={1}>
            {localize(state.quiz.title)}
          </Text>
          <Text style={styles.quizPickerChevron}>Change</Text>
        </PressBlock>
        {/* A native sheet, like any phone picker. */}
        <Modal visible={picking} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPicking(false)}>
          <View style={styles.sheet}>
            <View style={styles.grabber} />
            <View style={styles.sheetHead}>
              <Display style={styles.sheetTitle}>Pick a quiz</Display>
              <PressBlock offset={3} radius={12} onPress={() => setPicking(false)} accessibilityLabel="Close" style={styles.sheetClose}>
                <Icon name="close" size={18} />
              </PressBlock>
            </View>
            <ScrollView contentContainerStyle={styles.quizList}>
              {quizzes.map((quiz) => {
                const on = quiz.slug === state.settings.quizSlug;
                return (
                  <PressBlock
                    key={quiz.slug}
                    offset={on ? 2 : 4}
                    radius={14}
                    color={on ? colors.yellow : colors.white}
                    haptic="select"
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    onPress={() => {
                      setPicking(false);
                      if (!on) void send(LOBBY_COMMANDS.settings, { quizSlug: quiz.slug });
                    }}
                    style={styles.quizOption}
                  >
                    <View style={styles.quizOptionBody}>
                      <Text style={styles.quizOptionText}>{localize(quiz.title)}</Text>
                      <Text style={styles.quizOptionMeta}>
                        {quiz.category} · {quiz.questionCount} questions
                      </Text>
                    </View>
                    {on && <Icon name="check" size={20} />}
                  </PressBlock>
                );
              })}
            </ScrollView>
          </View>
        </Modal>
      </View>
      <View style={styles.settingTile}>
        <Segmented label="Questions" values={counts} current={state.settings.questionCount} format={String} onPick={(questionCount) => void send(LOBBY_COMMANDS.settings, { questionCount })} />
      </View>
      <View style={styles.settingTile}>
        <Segmented label="Time per question" values={times} current={state.settings.timeLimitS} format={(s) => `${s}s`} onPick={(timeLimitS) => void send(LOBBY_COMMANDS.settings, { timeLimitS })} />
      </View>
    </View>
  );
}

const OPEN_SEATS = 2;

function PlayerSeats({ state, isHost, send }: { state: LobbyState; isHost: boolean; send: Send }) {
  const openSeats = Math.max(0, Math.min(OPEN_SEATS, LOBBY_MAX_PLAYERS - state.players.length));
  return (
    <View style={styles.seats} accessibilityLabel="Players">
      {state.players.map((player) => {
        const host = player.id === state.hostId;
        const me = player.id === state.me;
        return (
          <Animated.View key={player.id} entering={ZoomIn.springify().damping(13)}>
            <Block offset={player.connected ? 4 : 0} radius={16} dashed={!player.connected} color={me ? colors.cream : colors.white} style={[styles.seat, !player.connected && styles.seatOffline]}>
              <View>
                <Avatar id={player.avatar} size="lg" />
                {host && <Text style={styles.crown}>👑</Text>}
              </View>
              <View style={styles.seatName}>
                <Display style={styles.seatTitle} numberOfLines={1}>
                  {nameWithTitle(player.username, player.title)}
                </Display>
                <View style={styles.tags}>
                  {host && <Chip label="Host" color={colors.yellow} />}
                  {me && <Chip label="You" color={colors.sky} />}
                  {!player.connected && <Chip label="Reconnecting…" dashed />}
                </View>
              </View>
              {isHost && !me && (
                <Pressable
                  onPress={() =>
                    void confirm({ title: `Remove ${player.username}?`, message: 'They can rejoin with the link.', action: 'Remove' }).then((yes) => {
                      if (yes) void send(LOBBY_COMMANDS.kick, { userId: player.id });
                    })
                  }
                  accessibilityRole="button" accessibilityLabel={`Remove ${player.username}`} hitSlop={8} style={styles.kick}>
                  <Text style={styles.kickText}>×</Text>
                </Pressable>
              )}
            </Block>
          </Animated.View>
        );
      })}
      {Array.from({ length: openSeats }, (_, seat) => (
        <View key={`open-${seat}`} style={styles.openSeat} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={styles.openAvatar}>
            <Text style={styles.openPlus}>+</Text>
          </View>
          <View style={styles.seatName}>
            <Text style={styles.openTitle}>Open seat</Text>
            <Text style={styles.openText}>Waiting for a player…</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function InviteFriends({ state }: { state: LobbyState }) {
  const { today } = useProgress();
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [sent, setSent] = useState<Record<string, 'sent' | 'failed'>>({});
  useEffect(() => {
    fetchFriends(today).then(
      (body) => setFriends(body.friends),
      () => setFriends([]),
    );
  }, [today]);
  const inLobby = new Set(state.players.map((player) => player.id));
  const candidates = (friends ?? []).filter((friend) => !inLobby.has(friend.id));
  const invite = async (friend: Friend) => {
    try {
      await inviteToLobby(state.code, friend.id);
      setSent((current) => ({ ...current, [friend.id]: 'sent' }));
    } catch {
      setSent((current) => ({ ...current, [friend.id]: 'failed' }));
    }
  };
  return (
    <Block offset={7} radius={22} border={3} style={styles.invite}>
      <Display style={styles.inviteTitle}>Invite Friends</Display>
      <Body style={styles.inviteLead}>They get a notification and can jump straight in.</Body>
      {friends === null ? (
        <Body style={styles.inviteLead}>Loading…</Body>
      ) : candidates.length === 0 ? (
        <View style={styles.inviteEmpty}>
          <Text style={styles.inviteEmoji}>{friends.length === 0 ? '👋' : '🎉'}</Text>
          {friends.length === 0 ? (
            <>
              <Body style={styles.center}>No Friends yet. Add Friends to invite them here, or share the Lobby link.</Body>
              <LinkButton label="Add Friends" onPress={() => router.push('/friends')} />
            </>
          ) : (
            <Body style={styles.center}>All your Friends are already here.</Body>
          )}
        </View>
      ) : (
        <View style={styles.inviteList}>
          {candidates.map((friend) => (
            <View key={friend.id} style={styles.inviteRow}>
              <Avatar id={friend.avatar} />
              <View style={styles.inviteName}>
                <Text style={styles.inviteUser} numberOfLines={1}>
                  {friend.username}
                </Text>
                <Text style={styles.inviteSub}>{friend.streak > 0 ? `🔥 ${friend.streak}-day streak` : friend.playedToday ? 'Played today' : 'Ready for a game'}</Text>
              </View>
              <Button
                size="sm"
                tone={sent[friend.id] === 'sent' ? 'lime' : 'yellow'}
                label={sent[friend.id] === 'sent' ? 'Invited ✓' : sent[friend.id] === 'failed' ? 'Retry' : 'Invite'}
                accessibilityLabel={`Invite ${friend.username}`}
                disabled={sent[friend.id] === 'sent'}
                onPress={() => void invite(friend)}
              />
            </View>
          ))}
        </View>
      )}
    </Block>
  );
}

/** The sticky bottom bar of the waiting room: Start for the Host, a waiting line for everyone else. */
export function WaitingActions({ state, send }: { state: LobbyState; send: Send }) {
  const isHost = state.hostId === state.me;
  const ready = state.players.filter((player) => player.connected).length;
  const hostName = state.players.find((player) => player.id === state.hostId)?.username ?? 'the Host';
  if (!isHost) {
    return (
      <View style={styles.waiting}>
        <Text style={styles.waitingText}>Waiting for {hostName} to start…</Text>
      </View>
    );
  }
  return (
    <>
      <PressBlock offset={6} radius={16} border={3} color={colors.lime} haptic="press" onPress={() => void send(LOBBY_COMMANDS.start)} accessibilityLabel="Start game" style={styles.start}>
        <Text style={styles.startText}>Start game</Text>
        <Text style={styles.startArrow}>▶</Text>
      </PressBlock>
      <Text style={styles.ready}>{ready <= 1 ? 'You can start alone, or invite friends first.' : `${ready} players ready`}</Text>
    </>
  );
}

/** The waiting room: join ticket, settings, player seats, start, and invites (FR-27–FR-30). */
export function WaitingRoom({ state, send }: { state: LobbyState; send: Send }) {
  const { me } = useAccount();
  const isHost = state.hostId === state.me;
  const [copied, setCopied] = useState<boolean | null>(null);

  const share = async () => {
    const link = lobbyLink(state.code);
    const shared = await shareText(`Join my KNO. quiz: ${localize(state.quiz.title)}\n${link}`);
    if (!shared) setCopied(await copyText(link));
  };
  const copy = async () => {
    setCopied(await copyText(lobbyLink(state.code)));
    setTimeout(() => setCopied(null), 2000);
  };
  return (
    <View style={styles.root}>
      <Block offset={8} radius={26} border={3} style={styles.room}>
        <View style={styles.top}>
          <Kicker>Waiting room</Kicker>
          <LivePill />
        </View>
        <Display style={styles.h1}>{localize(state.quiz.title)}</Display>

        <Block offset={6} radius={20} border={3} color={colors.yellow} style={styles.ticket}>
          <View style={styles.ticketCode}>
            <Label>Join code</Label>
            <CodeTiles code={state.code} />
          </View>
          <View style={styles.ticketShare}>
            <Button label="Share invite" tone="ink" icon="share" onPress={() => void share()} />
            <LinkButton label={copied === null ? 'Copy link' : copied ? 'Link copied ✓' : 'Copy failed'} color={colors.ink} onPress={() => void copy()} />
            <Text style={styles.ticketHint}>Anyone with the link can join until the game starts.</Text>
          </View>
        </Block>

        <Display style={styles.section}>Game settings</Display>
        <Settings state={state} isHost={isHost} send={send} />

        <View style={styles.sectionRow}>
          <Display style={styles.section}>Players</Display>
          <View style={styles.count}>
            <Text style={styles.countText}>
              {state.players.length}/{LOBBY_MAX_PLAYERS}
            </Text>
          </View>
        </View>
        <PlayerSeats state={state} isHost={isHost} send={send} />
      </Block>
      {me && <InviteFriends state={state} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 22 },
  room: { padding: 18, gap: 14 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  h1: { fontSize: 38, lineHeight: 42, letterSpacing: -2.2 },
  live: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 11, paddingVertical: 5, borderWidth: 2, borderColor: colors.ink, borderRadius: 999, backgroundColor: colors.white },
  liveDotWrap: { width: 10, height: 10, alignItems: 'center', justifyContent: 'center' },
  liveRing: { position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: colors.live },
  liveDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.live },
  liveText: { fontFamily: fonts.bodyBlack, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.ink },
  ticket: { padding: 16, gap: 14 },
  ticketCode: { gap: 9, paddingBottom: 14, borderBottomWidth: 3, borderBottomColor: colors.ink, borderStyle: 'dashed' },
  tiles: { flexDirection: 'row', gap: 6 },
  tile: { width: 42, height: 52, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.ink, borderRadius: 10, backgroundColor: colors.white, borderBottomWidth: 5 },
  tileText: { fontFamily: fonts.display, fontSize: 28, color: colors.ink },
  ticketShare: { gap: 10, alignItems: 'flex-start' },
  ticketHint: { fontFamily: fonts.bodyBold, fontSize: 13, lineHeight: 18, color: colors.ink },
  section: { fontSize: 24, letterSpacing: -1, marginTop: 10 },
  sectionRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  count: { paddingHorizontal: 10, paddingVertical: 3, borderWidth: 2, borderColor: colors.ink, borderRadius: 999, backgroundColor: colors.sky },
  countText: { fontFamily: fonts.display, fontSize: 14, color: colors.ink },
  settings: { gap: 12 },
  settingRow: { flexDirection: 'row', gap: 10 },
  settingTile: { gap: 8, padding: 12, borderWidth: 2, borderColor: colors.ink, borderRadius: 14, backgroundColor: colors.panel },
  half: { flex: 1 },
  quizTile: { backgroundColor: colors.violet },
  settingValue: { fontSize: 20 },
  setting: { gap: 9 },
  segmented: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  segment: { minWidth: 54, height: 42, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  segmentText: { fontFamily: fonts.display, fontSize: 17, color: colors.ink },
  quizPicker: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 46, paddingHorizontal: 12 },
  quizPickerText: { flex: 1, fontFamily: fonts.display, fontSize: 17, color: colors.ink },
  quizPickerChevron: { fontFamily: fonts.bodyHeavy, fontSize: 12, color: colors.blue },
  sheet: { flex: 1, backgroundColor: colors.paper, paddingTop: 10 },
  grabber: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: colors.faint, marginBottom: 8 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 12 },
  sheetTitle: { fontSize: 28, letterSpacing: -1.2 },
  sheetClose: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  quizList: { gap: 8, paddingHorizontal: 18, paddingBottom: 40 },
  quizOption: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  quizOptionBody: { flex: 1, gap: 2 },
  quizOptionText: { fontFamily: fonts.bodyHeavy, fontSize: 15, color: colors.ink },
  quizOptionMeta: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.muted },
  seats: { gap: 8 },
  seat: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  seatOffline: { opacity: 0.6 },
  crown: { position: 'absolute', top: -14, left: -8, fontSize: 20, transform: [{ rotate: '-18deg' }] },
  seatName: { flex: 1, gap: 6 },
  seatTitle: { fontSize: 18 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  kick: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.ink, borderRadius: 9, backgroundColor: colors.white },
  kickText: { fontSize: 20, lineHeight: 22, color: colors.ink },
  openSeat: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.ink, borderRadius: 16, opacity: 0.55 },
  openAvatar: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderStyle: 'dashed', borderColor: colors.ink, borderRadius: 15 },
  openPlus: { fontSize: 26, color: colors.ink },
  openTitle: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },
  openText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.ink },
  start: { minHeight: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  startText: { fontFamily: fonts.display, fontSize: 23, color: colors.ink },
  startArrow: { fontSize: 15, color: colors.ink },
  ready: { fontFamily: fonts.bodyHeavy, fontSize: 14, textAlign: 'center', color: colors.ink },
  waiting: { padding: 14, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.ink, borderRadius: 14, alignItems: 'center' },
  waitingText: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },
  invite: { padding: 18, gap: 10 },
  inviteTitle: { fontSize: 24, letterSpacing: -1 },
  inviteLead: { fontSize: 13, lineHeight: 18, color: colors.muted },
  inviteEmpty: { alignItems: 'center', gap: 8, padding: 16, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.ink, borderRadius: 14 },
  inviteEmoji: { fontSize: 30 },
  center: { textAlign: 'center', fontSize: 14 },
  inviteList: { gap: 10 },
  inviteRow: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 9, borderWidth: 2, borderColor: colors.ink, borderRadius: 14, backgroundColor: colors.panel },
  inviteName: { flex: 1, gap: 2 },
  inviteUser: { fontFamily: fonts.display, fontSize: 16, color: colors.ink },
  inviteSub: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.muted },
});
