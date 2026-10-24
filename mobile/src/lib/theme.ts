export const colors = {
  navy: '#1C2B4F',
  navyDeep: '#0F1A33',
  navySoft: '#33446E',
  ink: '#1A1D24',
  text2: '#3E4553',
  muted: '#5A6172',
  ground: '#F5F6F8',
  card: '#FFFFFF',
  line: '#E3E5EA',
  lineStrong: '#C9CDD6',
  marigold: '#F4A62A',
  marigoldSoft: '#FDF0D9',
  brown: '#7A4A00',
  brownDeep: '#4A2E00',
  teal: '#0E6E66',
  tealSoft: '#E3F2EF',
  tealDeep: '#0B4F49',
  red: '#B42318',
  redSoft: '#FDECEA',
  greySoft: '#F0F1F4',
  onNavyMuted: '#C9D2E6',
};

export const fonts = {
  regular: 'AtkinsonHyperlegible_400Regular',
  bold: 'AtkinsonHyperlegible_700Bold',
  hindi: 'NotoSansDevanagari_400Regular',
  hindiBold: 'NotoSansDevanagari_700Bold',
};

export const radius = { sm: 12, md: 16, lg: 22, xl: 24, pill: 999 };

/** Soft background colours for avatars, picked from the name so they stay stable. */
const AVATAR_BG = ['#FDF0D9', '#E4E9F5', '#E3F2EF', '#F3E8F6', '#FBE7E1', '#E8F0DE'];
export function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_BG[h % AVATAR_BG.length];
}
