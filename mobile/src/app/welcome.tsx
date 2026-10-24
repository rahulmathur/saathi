import { router } from 'expo-router';
import { View } from 'react-native';
import { Logo } from '@/components/Logo';
import { Button, Card, Icon, Row, Screen, Txt } from '@/components/ui';
import { colors } from '@/lib/theme';

export default function Welcome() {
  return (
    <Screen>
      <View style={{ paddingTop: 24, gap: 28 }}>
        <Logo size={44} />
        <View style={{ gap: 10 }}>
          <Txt variant="h1" style={{ fontSize: 34, lineHeight: 40 }}>
            No parent flies alone.
          </Txt>
          <Txt style={{ fontSize: 19, lineHeight: 27, color: colors.text2 }}>
            Find trusted company on your parents' flights, and follow every step of their journey.
          </Txt>
        </View>

        <Card style={{ gap: 12 }}>
          {[
            ['people', 'Meet families whose parents are on the same flight'],
            ['shield-checkmark', 'Names and numbers stay private until both families agree'],
            ['notifications', 'Get updates at every step, and an alert if they need help'],
          ].map(([icon, text]) => (
            <Row key={text} gap={12} style={{ alignItems: 'flex-start' }}>
              <Icon name={icon as 'people'} color={colors.teal} size={24} />
              <Txt style={{ flex: 1 }}>{text}</Txt>
            </Row>
          ))}
        </Card>

        <View style={{ gap: 12 }}>
          <Button label="I'm a family member" icon="person" onPress={() => router.push('/sign-in')} big />
          <Button label="I'm the traveller" icon="airplane" tone="gold" onPress={() => router.push('/pair')} big />
          <Txt variant="small" style={{ textAlign: 'center' }}>
            Travellers open the app with a code from their family. No email or password needed.
          </Txt>
        </View>
      </View>
    </Screen>
  );
}
