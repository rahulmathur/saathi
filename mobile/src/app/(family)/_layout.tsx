import { Tabs } from 'expo-router/tabs';
import { Icon } from '@/components/ui';
import { colors, fonts } from '@/lib/theme';

export default function FamilyTabs() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.navy,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontFamily: fonts.bold, fontSize: 13 },
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.line, minHeight: 64 },
        sceneStyle: { backgroundColor: colors.ground },
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: ({ color, focused }) => <Icon name={focused ? 'home' : 'home-outline'} color={color as string} size={24} /> }} />
      <Tabs.Screen name="add" options={{ title: 'Add trip', tabBarIcon: ({ color, focused }) => <Icon name={focused ? 'add-circle' : 'add-circle-outline'} color={color as string} size={26} /> }} />
      <Tabs.Screen name="requests" options={{ title: 'Requests', tabBarIcon: ({ color, focused }) => <Icon name={focused ? 'people' : 'people-outline'} color={color as string} size={24} /> }} />
      <Tabs.Screen name="account" options={{ title: 'Family', tabBarIcon: ({ color, focused }) => <Icon name={focused ? 'person-circle' : 'person-circle-outline'} color={color as string} size={26} /> }} />
    </Tabs>
  );
}
