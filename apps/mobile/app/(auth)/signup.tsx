import { View, Text, TouchableOpacity } from 'react-native';
import { Link } from 'expo-router';
import { colors } from '../../src/theme/colors';

export default function SignupScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', paddingHorizontal: 24 }}>
      <Text style={{ color: colors.text, fontSize: 24, fontWeight: '600', letterSpacing: -0.5, marginBottom: 8 }}>
        Create account
      </Text>
      <Text style={{ color: colors.textMuted, fontSize: 14, marginBottom: 30 }}>
        Full onboarding wizard coming soon.
      </Text>
      <Link href="/(auth)/login" asChild>
        <TouchableOpacity>
          <Text style={{ color: colors.blue, fontSize: 14 }}>← Back to login</Text>
        </TouchableOpacity>
      </Link>
    </View>
  );
}
