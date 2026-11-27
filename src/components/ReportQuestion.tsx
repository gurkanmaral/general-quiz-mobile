import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { RATE_LIMITED_CODE, REPORT_NOTE_MAX, type ReportSource } from '@/contracts';
import { useAccount } from '@/lib/account';
import { ApiProblemError, reportQuestion } from '@/lib/api';
import { Body, Button, ErrorText, Label, LinkButton } from '@/ui/kit';
import { colors, fonts } from '@/ui/theme';

type State = 'idle' | 'open' | 'sending' | 'sent';

/** "Report a wrong question" under any revealed Question (Story 6.1, FR-38). Signed-in only. */
export function ReportQuestion({ questionSlug, source, returnTo }: { questionSlug: string; source: ReportSource; returnTo?: string }) {
  const { requireSignIn } = useAccount();
  const [state, setState] = useState<State>('idle');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const open = () => {
    if (!requireSignIn(returnTo)) return;
    setState('open');
  };

  const send = async () => {
    setState('sending');
    setError(null);
    try {
      await reportQuestion({ questionSlug, source, note: note.trim() || undefined });
      setState('sent');
    } catch (caught) {
      setError(
        caught instanceof ApiProblemError && caught.code === RATE_LIMITED_CODE
          ? "You've sent a lot of reports. Please try again later."
          : "Couldn't send your report. Try again.",
      );
      setState('open');
    }
  };

  if (state === 'sent') return <Body style={styles.done}>Thanks — we'll check this question.</Body>;
  if (state === 'idle') return <LinkButton label="⚑ Report a wrong question" onPress={open} color={colors.ink} />;
  return (
    <View style={styles.form}>
      <Label>What looks wrong? (optional)</Label>
      <TextInput
        value={note}
        onChangeText={setNote}
        maxLength={REPORT_NOTE_MAX}
        multiline
        placeholder="e.g. The date in the story is wrong."
        placeholderTextColor={colors.faint}
        accessibilityLabel="What looks wrong?"
        style={styles.input}
      />
      {error && <ErrorText>{error}</ErrorText>}
      <View style={styles.row}>
        <Button label={state === 'sending' ? 'Sending…' : 'Send report'} size="sm" tone="white" busy={state === 'sending'} onPress={() => void send()} />
        <LinkButton label="Cancel" onPress={() => setState('idle')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  done: { fontFamily: fonts.bodyBold, fontSize: 14 },
  form: { gap: 8 },
  input: { minHeight: 80, padding: 12, borderWidth: 2, borderColor: colors.ink, borderRadius: 12, backgroundColor: colors.white, fontFamily: fonts.body, fontSize: 15, color: colors.ink, textAlignVertical: 'top' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16 },
});
