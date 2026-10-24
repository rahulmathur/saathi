import { View } from 'react-native';
import { colors, fonts } from '@/lib/theme';
import { Row, Txt } from './ui';

/** Two overlapping circles: two people travelling together. */
export function LogoMark({ size = 34 }: { size?: number }) {
  const r = size * 0.3;
  return (
    <View style={{ width: size, height: size, justifyContent: 'center' }} accessibilityElementsHidden importantForAccessibility="no">
      <View style={{ position: 'absolute', left: size * 0.08, width: r * 2, height: r * 2, borderRadius: r, backgroundColor: colors.navy }} />
      <View
        style={{ position: 'absolute', left: size * 0.32, width: r * 2, height: r * 2, borderRadius: r, backgroundColor: colors.marigold, opacity: 0.92 }}
      />
    </View>
  );
}

export function Logo({ size = 34 }: { size?: number }) {
  return (
    <Row gap={10}>
      <LogoMark size={size} />
      <Txt style={{ fontSize: size * 0.7, lineHeight: size, fontFamily: fonts.bold, color: colors.navy }}>Saathi</Txt>
    </Row>
  );
}
