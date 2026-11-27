import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { DELETE_ACCOUNT_CONFIRMATION } from '@/contracts';
import { nameWithTitle, useAccount } from '@/lib/account';
import { fetchSocialSettings, updateSocialSettings } from '@/lib/api';
import { BackBar, Screen } from '@/ui/Screen';
import { Avatar, Block, Body, Button, Display, ErrorText, Field, Kicker, LinkButton, Note, PageTitle } from '@/ui/kit';
import { colors, fonts } from '@/ui/theme';

/** Receiving Nudges from Friends can be turned off (FR-24). */
function NudgeSetting() {
  const [value, setValue] = useState<boolean | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let live = true;
    fetchSocialSettings().then(
      (settings) => live && setValue(settings.receiveNudges),
      () => {},
    );
    return () => {
      live = false;
    };
  }, []);
  const toggle = async (next: boolean) => {
    const previous = value;
    setValue(next);
    setError(false);
    try {
      setValue((await updateSocialSettings({ receiveNudges: next })).receiveNudges);
    } catch {
      setValue(previous);
      setError(true);
    }
  };
  return (
    <Block offset={5} radius={18} style={styles.card}>
      <View style={styles.toggleRow}>
        <View style={styles.toggleText}>
          <Display style={styles.toggleTitle}>Receive Nudges</Display>
          <Body style={styles.muted}>Friends can remind you when you haven't played today. No emails, ever.</Body>
        </View>
        <Switch value={value ?? false} disabled={value === null} onValueChange={(next) => void toggle(next)} trackColor={{ true: colors.lime, false: colors.stone }} thumbColor={colors.white} accessibilityLabel="Receive Nudges" />
      </View>
      {error && <ErrorText>Couldn't save this setting. Try again.</ErrorText>}
    </Block>
  );
}

function DeleteAccount() {
  const { deleteAccount } = useAccount();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const confirmed = typed.trim().toUpperCase() === DELETE_ACCOUNT_CONFIRMATION;
  const submit = async () => {
    if (!confirmed || busy) return;
    setBusy(true);
    setError('');
    try {
      await deleteAccount();
    } catch {
      setBusy(false);
      setError("Couldn't delete your account right now. Nothing was deleted — try again.");
    }
  };
  return (
    <Block offset={5} radius={18} color={colors.blush} style={styles.card}>
      <Display style={styles.toggleTitle}>Delete account</Display>
      <Body>Deletes your account, Username, Streak and Library for good. This cannot be undone.</Body>
      {!open ? (
        <Button label="Delete account…" tone="coral" onPress={() => setOpen(true)} />
      ) : (
        <View style={styles.form}>
          <Field label={`Type ${DELETE_ACCOUNT_CONFIRMATION} to confirm`} value={typed} onChangeText={setTyped} autoCapitalize="characters" autoCorrect={false} />
          {error ? <ErrorText>{error}</ErrorText> : null}
          <View style={styles.row}>
            <Button label={busy ? 'Deleting…' : 'Delete my account'} tone="coral" busy={busy} disabled={!confirmed} onPress={() => void submit()} />
            <LinkButton
              label="Cancel"
              onPress={() => {
                setOpen(false);
                setTyped('');
                setError('');
              }}
            />
          </View>
        </View>
      )}
    </Block>
  );
}

/** Settings: account details, profile, Nudges, sign out and Delete account (FR-4). */
export default function SettingsScreen() {
  const { me, ready, signOut, openSignIn, requireSignIn } = useAccount();
  if (!ready || !me) {
    return (
      <Screen header={<BackBar title="Settings" />}>
        <Note action={{ label: 'Sign in', onPress: () => requireSignIn('/settings') }}>Sign in to change your account settings.</Note>
      </Screen>
    );
  }
  return (
    <Screen header={<BackBar title="Settings" />}>
      <View style={styles.intro}>
        <Kicker>Your account</Kicker>
        <PageTitle>Settings</PageTitle>
      </View>
      <Block offset={7} radius={22} border={3} style={styles.account}>
        <Avatar id={me.avatar} size="lg" />
        <View style={styles.accountText}>
          <Display style={styles.accountName}>{nameWithTitle(me.username ?? '', me.title)}</Display>
          <Text style={styles.email}>{me.email}</Text>
        </View>
      </Block>
      <View style={styles.actions}>
        <Button label="Change Username or avatar" tone="white" onPress={() => openSignIn('profile', '/settings')} />
        <Button
          label="Sign out"
          tone="white"
          onPress={() => {
            void signOut();
            router.navigate('/');
          }}
        />
      </View>
      <NudgeSetting />
      <DeleteAccount />
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { gap: 12, alignItems: 'flex-start' },
  account: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  accountText: { flex: 1, gap: 4 },
  accountName: { fontSize: 22 },
  email: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.muted },
  actions: { gap: 10 },
  card: { padding: 16, gap: 12 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  toggleText: { flex: 1, gap: 4 },
  toggleTitle: { fontSize: 20 },
  muted: { fontSize: 13, lineHeight: 19, color: colors.muted },
  form: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16 },
});
