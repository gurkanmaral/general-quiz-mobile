/** KNO. design tokens, the same values as the web app's knowledge.css. */
export const colors = {
  ink: '#18181c',
  paper: '#f3efdf',
  white: '#fffdf5',
  blue: '#2147ff',
  lime: '#b9f227',
  coral: '#ff735d',
  yellow: '#ffd83d',
  sky: '#a9e9ff',
  // Pastel tiles and states
  violet: '#dbe1ff',
  blush: '#ffd8d0',
  mint: '#ecfbc4',
  cream: '#fff0a9',
  ice: '#dff7ff',
  lilac: '#f6e2ff',
  stone: '#ebe8de',
  panel: '#f6f2e4',
  correct: '#e4fbb0',
  live: '#1fbf4d',
  up: '#14803a',
  down: '#c53a26',
  muted: 'rgba(24,24,28,0.6)',
  faint: 'rgba(24,24,28,0.35)',
  grid: 'rgba(24,24,28,0.05)',
  artTop: '#20243a',
  artBottom: '#080a14',
} as const;

/** Font family names as loaded by useFonts in the root layout. */
export const fonts = {
  display: 'SpaceGrotesk_700Bold',
  displayMedium: 'SpaceGrotesk_600SemiBold',
  body: 'Inter_500Medium',
  bodyBold: 'Inter_700Bold',
  bodyHeavy: 'Inter_800ExtraBold',
  bodyBlack: 'Inter_900Black',
} as const;

/** Quiz accent colours by theme (web .kno-accent-*). */
export const accents: Record<string, string> = {
  violet: colors.violet,
  crimson: colors.blush,
  cyan: colors.ice,
  amber: colors.cream,
  coral: colors.blush,
  blue: colors.violet,
  emerald: colors.mint,
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 } as const;
