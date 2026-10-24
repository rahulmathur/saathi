import { View } from 'react-native';
import { city, flightLabel, shortDate } from '@/lib/format';
import { colors, fonts } from '@/lib/theme';
import type { Trip } from '@/lib/types';
import { Icon, Row, Txt } from './ui';

/** The big "DEL ✈ JFK" route block used on trip cards. */
export function Route({ trip }: { trip: Trip }) {
  return (
    <View style={{ gap: 6 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <View>
          <Txt style={{ fontSize: 36, lineHeight: 42, fontFamily: fonts.bold, color: colors.navy }}>{trip.origin}</Txt>
          <Txt variant="small">
            {city(trip.origin)}
            {trip.departTime ? ` · ${trip.departTime}` : ''}
          </Txt>
        </View>
        <Row style={{ flex: 1, paddingHorizontal: 12 }} gap={6}>
          <View style={{ flex: 1, borderTopWidth: 2, borderStyle: 'dashed', borderColor: colors.lineStrong }} />
          <Icon name="airplane" color={colors.marigold} size={24} />
          <View style={{ flex: 1, borderTopWidth: 2, borderStyle: 'dashed', borderColor: colors.lineStrong }} />
        </Row>
        <View style={{ alignItems: 'flex-end' }}>
          <Txt style={{ fontSize: 36, lineHeight: 42, fontFamily: fonts.bold, color: colors.navy }}>{trip.destination}</Txt>
          <Txt variant="small">
            {city(trip.destination)}
            {trip.arriveTime ? ` · ${trip.arriveTime}` : ''}
          </Txt>
        </View>
      </Row>
      <Txt style={{ fontSize: 15 }}>
        {shortDate(trip.flightDate)} · {flightLabel(trip.flightNumber)}
        {trip.seat ? ` · Seat ${trip.seat}` : ''}
      </Txt>
    </View>
  );
}
