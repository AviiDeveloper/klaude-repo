import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/store/auth';
import { colors } from '../../src/theme/colors';

export default function ProfileScreen() {
  const { user, logout } = useAuth();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
        <Text style={{ color: colors.text, fontSize: 24, fontWeight: '600', letterSpacing: -0.5 }}>Account</Text>
        <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 2 }}>{user?.name ?? 'Unknown'}</Text>
      </View>

      <View style={{ paddingHorizontal: 20, marginTop: 30 }}>
        <TouchableOpacity
          onPress={logout}
          style={{
            paddingVertical: 14,
            borderWidth: 0.5,
            borderColor: colors.border,
            borderRadius: 10,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: colors.red, fontSize: 14, fontWeight: '500' }}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
