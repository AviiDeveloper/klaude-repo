import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../src/theme/colors';

export default function PayoutsScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
        <Text style={{ color: colors.text, fontSize: 24, fontWeight: '600', letterSpacing: -0.5 }}>Payouts</Text>
        <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 2 }}>Track your earnings</Text>
      </View>
    </SafeAreaView>
  );
}
