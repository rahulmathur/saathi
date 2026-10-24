import { Pressable, View } from 'react-native';
import type { Lang } from '@/lib/parentText';
import { colors, fonts } from '@/lib/theme';
import { Txt } from './ui';

function Segment<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: [T, string][];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <View accessibilityLabel={label} style={{ flexDirection: 'row', backgroundColor: colors.greySoft, borderRadius: 999, padding: 4 }}>
      {options.map(([v, text]) => {
        const on = v === value;
        return (
          <Pressable
            key={String(v)}
            onPress={() => onChange(v)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={{ minHeight: 48, minWidth: 48, paddingHorizontal: 14, borderRadius: 999, justifyContent: 'center', backgroundColor: on ? colors.navy : 'transparent' }}
          >
            <Txt style={{ fontSize: 17, color: on ? '#FFFFFF' : colors.ink, fontFamily: on ? fonts.bold : fonts.regular, textAlign: 'center' }}>{text}</Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

export function LangSwitch({ lang, onChange }: { lang: Lang; onChange: (l: Lang) => void }) {
  return (
    <Segment<Lang>
      label="Language"
      value={lang}
      onChange={onChange}
      options={[
        ['en', 'English'],
        ['hi', 'हिंदी'],
      ]}
    />
  );
}

export function SizeSwitch({ scale, onChange }: { scale: number; onChange: (s: number) => void }) {
  return (
    <Segment<number>
      label="Text size"
      value={scale}
      onChange={onChange}
      options={[
        [1, 'A'],
        [1.2, 'A+'],
      ]}
    />
  );
}
