import * as Clipboard from 'expo-clipboard';
import { Share } from 'react-native';
import { WEB_URL } from './config';

/** Spoiler-free result text, e.g. "KNO. #012 ✅ 🔥 3" (same as the web). */
export function buildShareText(input: { issue: number; correct: boolean; streak: number; url?: string }): string {
  const parts = [`KNO. #${String(input.issue).padStart(3, '0')}`, input.correct ? '✅' : '❌'];
  if (input.streak > 0) parts.push(`🔥 ${input.streak}`);
  const line = parts.join(' ');
  return input.url ? `${line}\n${input.url}` : line;
}

/** Opens the system share sheet; resolves false when sharing failed. */
export async function shareText(message: string): Promise<boolean> {
  try {
    await Share.share({ message });
    return true;
  } catch {
    return false;
  }
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await Clipboard.setStringAsync(text);
    return true;
  } catch {
    return false;
  }
}

// Links people share open the web app; the app itself handles kno://lobby/<code> etc.
export const friendLink = (token: string) => `${WEB_URL}/f/${token}`;
export const nudgeLink = (token: string) => `${WEB_URL}/n/${token}`;
export const lobbyLink = (code: string) => `${WEB_URL}/l/${code}`;
export const webHome = WEB_URL;
