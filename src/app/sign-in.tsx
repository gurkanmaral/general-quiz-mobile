import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AVATAR_IDS, EMAIL_CODE_LENGTH, EmailCodeSchema, PASSWORD_MIN_LENGTH, UsernameSchema, type AvatarId, type MeResponse } from '@/contracts';
import { goTo, useAccount, type SignInStep } from '@/lib/account';
import { ApiProblemError, sendVerificationCode, signInWithEmail, signUpWithEmail, updateProfile, verifyEmailCode } from '@/lib/api';
import { AVATARS, Avatar, Body, Button, Display, ErrorText, Field, Icon, Label, LinkButton, PressBlock } from '@/ui/kit';
import { colors, fonts } from '@/ui/theme';

const OFFLINE = "Can't reach KNO. right now. Check your connection and try again.";

function authMessage(error: unknown): string {
  if (!(error instanceof ApiProblemError)) return OFFLINE;
  if (error.status === 429) return 'Too many tries. Wait a few seconds and try again.';
  switch (error.code) {
    case 'INVALID_EMAIL_OR_PASSWORD':
      return 'Wrong email or password.';
    case 'USER_ALREADY_EXISTS':
    case 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL':
      return 'There is already an account with this email. Sign in instead.';
    case 'PASSWORD_TOO_SHORT':
      return `Use at least ${PASSWORD_MIN_LENGTH} characters for your password.`;
    case 'INVALID_EMAIL':
      return 'Enter a valid email address.';
    default:
      return error.detail ?? 'Something went wrong. Try again.';
  }
}

const TITLES: Record<SignInStep, string> = {
  signIn: 'Sign in to KNO.',
  signUp: 'Create your account',
  checkEmail: 'Enter your code',
  profile: 'Make it yours',
};

function EmailForm({ mode, onDone }: { mode: 'signIn' | 'signUp'; onDone: (email: string, outcome: 'signedIn' | 'checkEmail') => Promise<void> }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError('');
    setBusy(true);
    const address = email.trim();
    try {
      if (mode === 'signUp') {
        await signUpWithEmail({ name: '', email: address, password, callbackURL: '/' });
        await onDone(address, 'checkEmail');
      } else {
        await signInWithEmail({ email: address, password, rememberMe: true });
        await onDone(address, 'signedIn');
      }
    } catch (caught) {
      if (caught instanceof ApiProblemError && caught.code === 'EMAIL_NOT_VERIFIED') {
        await onDone(address, 'checkEmail');
        return;
      }
      setError(authMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.form}>
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" autoCorrect={false} />
      <Field
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
        textContentType={mode === 'signUp' ? 'newPassword' : 'password'}
        hint={mode === 'signUp' ? `At least ${PASSWORD_MIN_LENGTH} characters.` : undefined}
        onSubmitEditing={() => void submit()}
      />
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button label={mode === 'signUp' ? 'Create account' : 'Sign in'} size="lg" busy={busy} disabled={!email.trim() || !password} onPress={() => void submit()} />
    </View>
  );
}

function CheckEmail({ email, onConfirmed, onBack }: { email: string; onConfirmed: () => Promise<void>; onBack: () => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [resent, setResent] = useState<'idle' | 'sent' | 'failed'>('idle');

  const verify = async () => {
    const checked = EmailCodeSchema.safeParse(code.trim());
    if (!checked.success) {
      setError('Enter the 6-digit code.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await verifyEmailCode({ email, otp: checked.data });
      await onConfirmed();
    } catch (caught) {
      setError(caught instanceof ApiProblemError ? 'That code is wrong or has expired. Check it or get a new one.' : OFFLINE);
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    try {
      await sendVerificationCode(email);
      setResent('sent');
    } catch {
      setResent('failed');
    }
  };

  return (
    <View style={styles.form}>
      <Body>
        We sent a 6-digit code to <Text style={styles.bold}>{email}</Text>. Enter it to finish signing in.
      </Body>
      <Label>Code</Label>
      <TextInput
        value={code}
        onChangeText={(value) => setCode(value.replace(/\D/g, ''))}
        maxLength={EMAIL_CODE_LENGTH}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        autoFocus
        accessibilityLabel="Code"
        style={styles.code}
        onSubmitEditing={() => void verify()}
      />
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button label="Confirm" size="lg" busy={busy} disabled={code.length !== EMAIL_CODE_LENGTH} onPress={() => void verify()} />
      <View style={styles.row}>
        <Button label={resent === 'sent' ? 'New code sent' : 'Send a new code'} tone="white" size="sm" disabled={resent === 'sent'} onPress={() => void resend()} />
        <LinkButton label="Back to sign in" onPress={onBack} />
      </View>
      {resent === 'failed' && <ErrorText>Couldn’t send a new code right now. Try again in a minute.</ErrorText>}
    </View>
  );
}

function ProfileStep({ onSaved }: { onSaved: (me: MeResponse) => void }) {
  const { me, signOut } = useAccount();
  const [username, setUsername] = useState(me?.username ?? '');
  const [avatar, setAvatar] = useState<AvatarId>(me?.avatar ?? 'owl');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const checked = UsernameSchema.safeParse(username);
    if (!checked.success) {
      setError(checked.error.issues[0]?.message ?? 'Pick another Username.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      onSaved(await updateProfile({ username: checked.data, avatar }));
    } catch (caught) {
      setError(caught instanceof ApiProblemError ? (caught.detail ?? 'Pick another Username.') : OFFLINE);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.form}>
      <Field label="Username" value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} autoComplete="username" maxLength={20} hint="3–20 letters, numbers or _. Friends will see it." />
      <Label>Pick your avatar</Label>
      <View style={styles.avatars} accessibilityRole="radiogroup" accessibilityLabel="Avatar">
        {AVATAR_IDS.map((option) => {
          const selected = avatar === option;
          return (
            <Pressable
              key={option}
              onPress={() => setAvatar(option)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={AVATARS[option].label}
              style={[styles.avatarOption, selected && styles.avatarSelected]}
            >
              <Avatar id={option} size="lg" />
            </Pressable>
          );
        })}
      </View>
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button label="Save and continue" size="lg" busy={busy} disabled={!username.trim()} onPress={() => void submit()} />
      <LinkButton label="Sign out" onPress={() => void signOut().then(() => router.back())} />
    </View>
  );
}

/** Sign in, sign up, the 6-digit email code and the profile step (web SignInSheet). */
export default function SignInScreen() {
  const params = useLocalSearchParams<{ step?: string; returnTo?: string }>();
  const initial: SignInStep = params.step === 'signUp' || params.step === 'profile' || params.step === 'checkEmail' ? params.step : 'signIn';
  const returnTo = params.returnTo ?? '';
  const { refresh, me } = useAccount();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<SignInStep>(initial);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  // The profile step is required once signed in; it can be dismissed only when editing a finished profile.
  const canClose = step !== 'profile' || Boolean(me?.profileComplete);

  const finish = (next: MeResponse) => {
    if (!next.profileComplete) {
      setStep('profile');
      return;
    }
    if (router.canGoBack()) router.back();
    if (returnTo) setTimeout(() => goTo(returnTo), 50);
  };

  const afterSignIn = async () => {
    const next = await refresh();
    if (next) finish(next);
    else setError(OFFLINE);
  };

  const onEmailDone = async (address: string, outcome: 'signedIn' | 'checkEmail') => {
    setEmail(address);
    if (outcome === 'checkEmail') setStep('checkEmail');
    else await afterSignIn();
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 30 }]} keyboardShouldPersistTaps="handled">
        <View style={styles.grabber} />
        <View style={styles.head}>
          <Display style={styles.title} accessibilityRole="header">
            {TITLES[step]}
          </Display>
          {canClose && (
            <PressBlock offset={3} radius={12} onPress={() => router.back()} accessibilityLabel="Close" style={styles.close}>
              <Icon name="close" size={18} />
            </PressBlock>
          )}
        </View>
        {step === 'profile' && <Body>Pick a Username and an avatar. You can play right after.</Body>}
        {(step === 'signIn' || step === 'signUp') && (
          <>
            <Body>Keep your Streak and Library on every device.</Body>
            <EmailForm key={step} mode={step} onDone={onEmailDone} />
            {error ? <ErrorText>{error}</ErrorText> : null}
            <View style={styles.switch}>
              <Body>{step === 'signIn' ? 'New to KNO.?' : 'Already have an account?'}</Body>
              <LinkButton label={step === 'signIn' ? 'Create an account' : 'Sign in'} onPress={() => setStep(step === 'signIn' ? 'signUp' : 'signIn')} />
            </View>
          </>
        )}
        {step === 'checkEmail' && <CheckEmail email={email} onConfirmed={afterSignIn} onBack={() => setStep('signIn')} />}
        {step === 'profile' && <ProfileStep onSaved={(next) => void refresh().then(() => finish(next))} />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  content: { padding: 22, gap: 16 },
  grabber: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: colors.faint, marginBottom: 4 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { flex: 1, fontSize: 32, lineHeight: 35, letterSpacing: -1.8 },
  close: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  form: { gap: 14 },
  bold: { fontFamily: fonts.bodyHeavy },
  code: { height: 64, borderWidth: 3, borderColor: colors.ink, borderRadius: 14, backgroundColor: colors.white, textAlign: 'center', fontFamily: fonts.display, fontSize: 30, letterSpacing: 12, color: colors.ink },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  avatars: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  avatarOption: { padding: 7, borderWidth: 2, borderColor: 'transparent', borderRadius: 16 },
  avatarSelected: { borderColor: colors.ink, backgroundColor: colors.panel, borderBottomWidth: 5, borderBottomColor: colors.blue },
  switch: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
});
