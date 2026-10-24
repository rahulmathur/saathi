import { Linking } from 'react-native';
import type { Match } from './types';

export function call(phone: string) {
  Linking.openURL(`tel:${phone}`);
}

export function whatsapp(phone: string, text?: string) {
  const num = phone.replace(/[^\d]/g, '');
  Linking.openURL(`https://wa.me/${num}${text ? `?text=${encodeURIComponent(text)}` : ''}`);
}

/** Matches shown on the list, kept so the profile screen can open instantly. */
export const matchCache = new Map<string, Match>();
