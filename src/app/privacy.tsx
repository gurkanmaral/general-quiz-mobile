import * as Linking from 'expo-linking';
import { getLocales } from 'expo-localization';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BackBar, Screen } from '@/ui/Screen';
import { Block, Body, Button, Display, Kicker, Label, LinkButton } from '@/ui/kit';
import { colors, fonts } from '@/ui/theme';

type Lang = 'en' | 'tr';

/** Placeholder until the real address is set (Story 6.3); same as the web app. */
export const PRIVACY_CONTACT = 'privacy@kno.example';

type Notice = {
  kicker: string;
  title: string;
  lead: string;
  updated: string;
  storedTitle: string;
  stored: { name: string; detail: string }[];
  deviceTitle: string;
  device: string;
  useTitle: string;
  use: string[];
  sharingTitle: string;
  sharing: string;
  keepTitle: string;
  keep: string;
  rightsTitle: string;
  rightsLead: string;
  rights: string[];
  contactTitle: string;
  contact: string;
};

const NOTICE: Record<Lang, Notice> = {
  en: {
    kicker: 'Privacy',
    title: 'What KNO. stores',
    lead: 'KNO. is a daily quiz. We keep only what the game needs, we show no ads and we use no tracking cookies.',
    updated: 'Last updated: November 2026',
    storedTitle: 'What we store when you have an account',
    stored: [
      { name: 'Account', detail: 'Your email address, username, avatar and, if you use Google sign-in, your Google account id. Passwords are stored only as a hash.' },
      { name: 'Sessions', detail: 'A sign-in cookie, plus the IP address and browser of each session, to keep you signed in and to stop abuse.' },
      { name: 'Play', detail: 'Your Daily answers and Streak, Solo Games, Lobby results, Quiz Records, Badges and your equipped Title.' },
      { name: 'Friends', detail: 'Friends, Friend Requests, your friend link, Nudges, notifications and your social settings.' },
      { name: 'Reports', detail: 'Questions you report as wrong, with your optional note.' },
    ],
    deviceTitle: 'On your device only',
    device: 'Without an account, your Daily history and language choice stay in your browser’s local storage. We never receive them unless you sign in and choose to merge them.',
    useTitle: 'Why we use it',
    use: ['To run the game: questions, scores, Streaks, Badges and Lobbies.', 'To show your Profile to Friends and to players you played a Lobby with.', 'To send sign-in emails.', 'To keep KNO. safe, for example with rate limits.'],
    sharingTitle: 'Who else sees it',
    sharing: 'We do not sell your data. Our hosting provider, our email provider (sign-in emails) and Google (only if you use Google sign-in) process data for us.',
    keepTitle: 'How long we keep it',
    keep: 'Until you delete your account. Deleting it in Settings removes your account and everything listed above straight away.',
    rightsTitle: 'Your rights (KVKK and GDPR)',
    rightsLead: 'Under Türkiye’s Law No. 6698 (KVKK) and the EU GDPR you can:',
    rights: [
      'learn whether we process your data and get a copy of it (data export);',
      'have wrong data corrected — you can change your username and avatar yourself;',
      'have your data deleted — use Delete account in Settings;',
      'object to processing or ask us to restrict it;',
      'complain to the Personal Data Protection Authority (KVKK) or your EU data protection authority.',
    ],
    contactTitle: 'Contact and data export',
    contact: 'For a copy of your data or any privacy question, email us from the address on your account. We answer within 30 days.',
  },
  tr: {
    kicker: 'Gizlilik',
    title: 'KNO. neleri saklar',
    lead: 'KNO. günlük bir bilgi oyunudur. Yalnızca oyunun ihtiyaç duyduğu verileri saklarız; reklam göstermeyiz ve izleme çerezi kullanmayız.',
    updated: 'Son güncelleme: Kasım 2026',
    storedTitle: 'Hesabınız varsa sakladıklarımız',
    stored: [
      { name: 'Hesap', detail: 'E-posta adresiniz, kullanıcı adınız, avatarınız ve Google ile giriş yaparsanız Google hesap kimliğiniz. Şifreler yalnızca özet (hash) olarak saklanır.' },
      { name: 'Oturumlar', detail: 'Oturumunuzu açık tutmak ve kötüye kullanımı önlemek için bir giriş çerezi ile her oturumun IP adresi ve tarayıcı bilgisi.' },
      { name: 'Oyun', detail: 'Günlük soru cevaplarınız ve seriniz, Solo Oyunlar, Lobi sonuçları, Quiz Kayıtları, Rozetler ve kullandığınız Unvan.' },
      { name: 'Arkadaşlar', detail: 'Arkadaşlar, Arkadaşlık İstekleri, arkadaş bağlantınız, Dürtmeler, bildirimler ve sosyal ayarlarınız.' },
      { name: 'Hata bildirimleri', detail: 'Hatalı olarak bildirdiğiniz sorular ve isteğe bağlı notunuz.' },
    ],
    deviceTitle: 'Yalnızca cihazınızda',
    device: 'Hesabınız yoksa Günlük geçmişiniz ve dil seçiminiz tarayıcınızın yerel depolamasında kalır. Giriş yapıp birleştirmeyi seçmedikçe bu veriler bize ulaşmaz.',
    useTitle: 'Neden kullanırız',
    use: ['Oyunu çalıştırmak için: sorular, puanlar, seriler, Rozetler ve Lobiler.', 'Profilinizi Arkadaşlarınıza ve Lobide birlikte oynadığınız oyunculara göstermek için.', 'Giriş e-postaları göndermek için.', 'KNO.’yu güvende tutmak için (ör. istek sınırları).'],
    sharingTitle: 'Başka kimler görür',
    sharing: 'Verilerinizi satmayız. Barındırma sağlayıcımız, e-posta sağlayıcımız (giriş e-postaları) ve Google (yalnızca Google ile giriş yaparsanız) verileri bizim adımıza işler.',
    keepTitle: 'Ne kadar saklarız',
    keep: 'Hesabınızı silene kadar. Ayarlar’daki Hesabı sil seçeneği hesabınızı ve yukarıdaki tüm verileri hemen siler.',
    rightsTitle: 'Haklarınız (KVKK ve GDPR)',
    rightsLead: '6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) ve AB GDPR kapsamında şunları yapabilirsiniz:',
    rights: [
      'verilerinizin işlenip işlenmediğini öğrenmek ve bir kopyasını almak (veri dışa aktarımı);',
      'yanlış verilerin düzeltilmesini istemek — kullanıcı adınızı ve avatarınızı kendiniz değiştirebilirsiniz;',
      'verilerinizin silinmesini istemek — Ayarlar’da Hesabı sil seçeneğini kullanın;',
      'işlemeye itiraz etmek veya kısıtlanmasını istemek;',
      'Kişisel Verileri Koruma Kurumu’na ya da AB’deki veri koruma otoritenize şikâyette bulunmak.',
    ],
    contactTitle: 'İletişim ve veri dışa aktarımı',
    contact: 'Verilerinizin bir kopyası veya gizlilikle ilgili her soru için hesabınızdaki e-posta adresinden bize yazın. 30 gün içinde yanıt veririz.',
  },
};

/** The privacy notice (Story 6.3) in English and Turkish, the same text as the web app. */
export default function PrivacyScreen() {
  const [lang, setLang] = useState<Lang>(() => (getLocales()[0]?.languageCode === 'tr' ? 'tr' : 'en'));
  const t = NOTICE[lang];
  return (
    <Screen header={<BackBar title={t.kicker} />}>
      <View style={styles.langs} accessibilityLabel="Language / Dil">
        {(['en', 'tr'] as const).map((code) => (
          <Button key={code} size="sm" tone={lang === code ? 'ink' : 'white'} label={code === 'en' ? 'English' : 'Türkçe'} onPress={() => setLang(code)} />
        ))}
      </View>
      <View style={styles.intro}>
        <Kicker>{t.kicker}</Kicker>
        <Display style={styles.h1}>{t.title}</Display>
        <Body style={styles.lead}>{t.lead}</Body>
        <Label style={styles.muted}>{t.updated}</Label>
      </View>
      <Block offset={5} radius={18} style={styles.card}>
        <Display style={styles.h2}>{t.storedTitle}</Display>
        {t.stored.map((item) => (
          <View key={item.name} style={styles.item}>
            <Label>{item.name}</Label>
            <Body>{item.detail}</Body>
          </View>
        ))}
      </Block>
      <Block offset={5} radius={18} color={colors.mint} style={styles.card}>
        <Display style={styles.h2}>{t.deviceTitle}</Display>
        <Body>{t.device}</Body>
      </Block>
      <Block offset={5} radius={18} style={styles.card}>
        <Display style={styles.h2}>{t.useTitle}</Display>
        {t.use.map((item) => (
          <Body key={item}>• {item}</Body>
        ))}
        <Display style={styles.h2}>{t.sharingTitle}</Display>
        <Body>{t.sharing}</Body>
        <Display style={styles.h2}>{t.keepTitle}</Display>
        <Body>{t.keep}</Body>
      </Block>
      <Block offset={5} radius={18} style={styles.card}>
        <Display style={styles.h2}>{t.rightsTitle}</Display>
        <Body>{t.rightsLead}</Body>
        {t.rights.map((item) => (
          <Body key={item}>• {item}</Body>
        ))}
      </Block>
      <Block offset={5} radius={18} color={colors.yellow} style={styles.card}>
        <Display style={styles.h2}>{t.contactTitle}</Display>
        <Body>{t.contact}</Body>
        <LinkButton label={PRIVACY_CONTACT} color={colors.ink} onPress={() => void Linking.openURL(`mailto:${PRIVACY_CONTACT}`)} />
      </Block>
      <Text style={styles.end}>KNO.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  langs: { flexDirection: 'row', gap: 8 },
  intro: { gap: 12, alignItems: 'flex-start' },
  h1: { fontSize: 40, lineHeight: 44, letterSpacing: -2.2 },
  lead: { fontSize: 17, lineHeight: 25 },
  muted: { color: colors.muted },
  card: { padding: 18, gap: 10 },
  h2: { fontSize: 21, lineHeight: 24 },
  item: { gap: 3 },
  end: { fontFamily: fonts.display, fontSize: 18, color: colors.faint, textAlign: 'center' },
});
