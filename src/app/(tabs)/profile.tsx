import { router, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { localize, type ProfileAward, type ProfileResponse } from '@/contracts';
import { useAccount } from '@/lib/account';
import { equipTitle, fetchProfile } from '@/lib/api';
import { useNotifications } from '@/lib/notifications';
import { useProgress } from '@/lib/progress';
import { rarityText } from '@/components/Unlocks';
import { AppHeader, Screen } from '@/ui/Screen';
import { Avatar, Block, Body, Button, Display, Icon, Kicker, Label, LinkButton, Note, PageTitle, PressBlock, Skeleton } from '@/ui/kit';
import { colors, fonts } from '@/ui/theme';

type State = { status: 'loading' } | { status: 'error' } | { status: 'ready'; profile: ProfileResponse };

function AwardCard({ award, equipped, busy, onEquip }: { award: ProfileAward; equipped: boolean; busy: boolean; onEquip: (slug: string | null) => void }) {
  const name = localize(award.name);
  const bg = !award.earned ? colors.panel : award.kind === 'badge' ? colors.cream : colors.violet;
  return (
    <Block offset={award.earned ? 4 : 0} radius={16} dashed={!award.earned} color={bg} style={[styles.award, !award.earned && styles.awardLocked]}>
      <Text style={[styles.awardIcon, !award.earned && styles.locked]}>{award.icon}</Text>
      <View style={styles.awardBody} accessible accessibilityLabel={`${name} (${award.kind === 'badge' ? 'Badge' : 'Title'}${award.earned ? '' : ', not earned yet'})`}>
        <Label>{award.kind === 'badge' ? 'Badge' : 'Title'}</Label>
        <Display style={styles.awardName}>{name}</Display>
        <Body style={styles.awardText}>{award.earned ? localize(award.description) : award.howToEarn}</Body>
        <Text style={styles.rarity}>{rarityText(award.rarity)}</Text>
        {award.kind === 'title' && award.earned && (
          <Button
            size="sm"
            tone={equipped ? 'lime' : 'white'}
            label={equipped ? 'Equipped ✓' : 'Equip'}
            accessibilityLabel={equipped ? `Unequip ${name}` : `Equip ${name}`}
            disabled={busy}
            onPress={() => onEquip(equipped ? null : award.slug)}
            style={styles.equip}
          />
        )}
      </View>
    </Block>
  );
}

function MenuLink({ label, detail, href, badge }: { label: string; detail: string; href: Href; badge?: number }) {
  return (
    <PressBlock offset={4} down={false} radius={14} onPress={() => router.push(href)} accessibilityRole="link" accessibilityLabel={badge ? `${label}, ${badge} unread` : label} style={styles.menu}>
      <View style={styles.menuBody}>
        <Display style={styles.menuLabel}>{label}</Display>
        <Body style={styles.menuDetail}>{detail}</Body>
      </View>
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      ) : null}
      <Icon name="arrow" size={20} />
    </PressBlock>
  );
}

/** The Profile tab (FR-20): name, avatar, Title, Streak and the Badge/Title collection. */
export default function ProfileScreen() {
  const { status, ready, refresh, openSignIn } = useAccount();
  const { today } = useProgress();
  const { unread } = useNotifications();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    let live = true;
    fetchProfile(today).then(
      (profile) => live && setState({ status: 'ready', profile }),
      () => live && setState({ status: 'error' }),
    );
    return () => {
      live = false;
    };
  }, [ready, today, attempt]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  const onEquip = async (slug: string | null) => {
    if (state.status !== 'ready' || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { title } = await equipTitle(slug);
      setState({ status: 'ready', profile: { ...state.profile, title } });
      void refresh();
    } catch {
      setError("Couldn't change your Title. Try again.");
    } finally {
      setBusy(false);
    }
  };

  if (!ready) {
    return (
      <Screen header={<AppHeader />}>
        <View style={styles.intro}>
          <Kicker>Your profile</Kicker>
          <PageTitle>Profile</PageTitle>
        </View>
        <Block offset={8} radius={24} border={3} color={colors.yellow} style={styles.signedOut}>
          <Text style={styles.bigEmoji}>🦉</Text>
          <Display style={styles.signedOutTitle}>Keep your streak everywhere.</Display>
          <Body>Sign in to save your Library, play quizzes, earn badges and titles, and add Friends.</Body>
          <Button label={status === 'signedIn' ? 'Finish your profile' : 'Sign in or create an account'} tone="ink" size="lg" disabled={status === 'loading'} onPress={() => openSignIn(status === 'signedIn' ? 'profile' : 'signIn', '/profile')} />
        </Block>
        <MenuLink label="Daily reminder" detail="Get a nudge when the new question is out" href="/settings" />
        <LinkButton label="Privacy · Gizlilik" color={colors.ink} onPress={() => router.push('/privacy')} />
      </Screen>
    );
  }

  return (
    <Screen header={<AppHeader />} onRefresh={retry}>
      {state.status === 'loading' && <Skeleton count={3} height={110} label="Loading your profile" />}
      {state.status === 'error' && (
        <Note tone="error" action={{ label: 'Try again', onPress: retry }}>
          Couldn't load your profile.
        </Note>
      )}
      {state.status === 'ready' && (
        <>
          <View style={styles.head}>
            <View style={styles.headAvatar}>
              <Avatar id={state.profile.avatar} size="xl" />
            </View>
            <View style={styles.headName}>
              <Kicker>Your profile</Kicker>
              <Display style={styles.name}>
                {state.profile.username}
                {state.profile.title && <Text style={styles.title}> · {localize(state.profile.title.name)}</Text>}
              </Display>
            </View>
          </View>
          <View style={styles.stats}>
            {[
              { label: 'Streak', value: `🔥 ${state.profile.streak.current}`, color: colors.cream },
              { label: 'Best', value: String(state.profile.streak.best), color: colors.sky },
              {
                label: 'Collected',
                value: `${state.profile.quizzes.flatMap((quiz) => quiz.awards).filter((award) => award.earned).length}/${state.profile.quizzes.flatMap((quiz) => quiz.awards).length}`,
                color: colors.mint,
              },
            ].map((stat) => (
              <Block key={stat.label} outerStyle={styles.statOuter} offset={4} radius={14} color={stat.color} style={styles.stat}>
                <Label>{stat.label}</Label>
                <Display style={styles.statValue}>{stat.value}</Display>
              </Block>
            ))}
          </View>
          <View style={styles.menuList}>
            <MenuLink label="Friends" detail="Who played today, nudges and requests" href="/friends" />
            <MenuLink label="Notifications" detail="Requests, nudges and Lobby invites" href="/notifications" badge={unread} />
            <MenuLink label="Settings" detail="Daily reminder, account, nudges, sign out" href="/settings" />
          </View>
          <View style={styles.equipInfo}>
            <Body style={styles.equipText}>
              {state.profile.title ? (
                <>
                  Showing <Text style={styles.bold}>{localize(state.profile.title.name)}</Text> next to your name.
                </>
              ) : (
                'No Title equipped. Unlock one in a quiz, then equip it here.'
              )}
            </Body>
            {state.profile.title && <LinkButton label="Show no Title" disabled={busy} onPress={() => void onEquip(null)} />}
          </View>
          {error && <Note tone="error">{error}</Note>}
          {state.profile.quizzes.length === 0 && <Note>Play a quiz to start your collection.</Note>}
          {state.profile.quizzes.map((quiz) => (
            <View key={quiz.slug} style={styles.collection}>
              <Display style={styles.collectionTitle}>{localize(quiz.title)}</Display>
              {quiz.awards.map((award) => (
                <AwardCard key={award.slug} award={award} equipped={state.profile.title?.slug === award.slug} busy={busy} onEquip={(slug) => void onEquip(slug)} />
              ))}
            </View>
          ))}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { gap: 12, alignItems: 'flex-start' },
  signedOut: { padding: 20, gap: 12 },
  bigEmoji: { fontSize: 48 },
  signedOutTitle: { fontSize: 30, lineHeight: 33, letterSpacing: -1.4 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  headAvatar: { transform: [{ rotate: '-4deg' }] },
  headName: { flex: 1, gap: 8, alignItems: 'flex-start' },
  name: { fontSize: 34, lineHeight: 37, letterSpacing: -1.8 },
  title: { color: colors.blue },
  stats: { flexDirection: 'row', gap: 6 },
  statOuter: { flex: 1 },
  stat: { padding: 12, gap: 4 },
  statValue: { fontSize: 22 },
  menuList: { gap: 10 },
  menu: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  menuBody: { flex: 1, gap: 2 },
  menuLabel: { fontSize: 20 },
  menuDetail: { fontSize: 13, color: colors.muted },
  badge: { minWidth: 24, height: 24, paddingHorizontal: 6, borderRadius: 12, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.coral, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: fonts.bodyBlack, fontSize: 11, color: colors.ink },
  equipInfo: { gap: 6, padding: 14, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.ink, borderRadius: 14 },
  equipText: { fontSize: 14 },
  bold: { fontFamily: fonts.bodyHeavy },
  collection: { gap: 10 },
  collectionTitle: { fontSize: 26, letterSpacing: -1.2 },
  award: { flexDirection: 'row', gap: 14, padding: 14, alignItems: 'flex-start' },
  awardLocked: { opacity: 0.75 },
  awardIcon: { fontSize: 34 },
  locked: { opacity: 0.35 },
  awardBody: { flex: 1, gap: 4, alignItems: 'flex-start' },
  awardName: { fontSize: 20 },
  awardText: { fontSize: 13, lineHeight: 19 },
  rarity: { fontFamily: fonts.bodyHeavy, fontSize: 12, color: colors.blue },
  equip: { marginTop: 6 },
});
