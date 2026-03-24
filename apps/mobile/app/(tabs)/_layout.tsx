import { Tabs } from 'expo-router';
import { colors } from '../../src/theme/colors';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopColor: colors.border,
          borderTopWidth: 0.5,
          height: 80,
          paddingBottom: 28,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.white,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Leads', tabBarLabel: 'Leads' }}
      />
      <Tabs.Screen
        name="map"
        options={{ title: 'Map', tabBarLabel: 'Map' }}
      />
      <Tabs.Screen
        name="payouts"
        options={{ title: 'Payouts', tabBarLabel: 'Payouts' }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Account', tabBarLabel: 'Account' }}
      />
    </Tabs>
  );
}
