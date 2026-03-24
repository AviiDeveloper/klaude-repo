import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Link } from 'expo-router';
import { useAuth } from '../../src/store/auth';
import { colors } from '../../src/theme/colors';

export default function LoginScreen() {
  const { login } = useAuth();
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!name.trim() || !pin.trim()) return;
    setLoading(true);
    setError('');
    const ok = await login(name.trim(), pin.trim());
    if (!ok) setError('Invalid credentials');
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: colors.bg }}
    >
      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 24 }}>
        {/* Logo */}
        <Text style={{ color: colors.white, fontSize: 20, fontWeight: '600', letterSpacing: -0.5, marginBottom: 4 }}>
          ▲ SalesFlow
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 14, marginBottom: 40 }}>
          Walk in. Pitch. Sell.
        </Text>

        {/* Inputs */}
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Username"
          placeholderTextColor={colors.textFaint}
          autoCapitalize="none"
          autoCorrect={false}
          style={{
            backgroundColor: colors.elevated,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 10,
            paddingHorizontal: 16,
            paddingVertical: 14,
            color: colors.text,
            fontSize: 15,
            marginBottom: 8,
          }}
        />
        <TextInput
          value={pin}
          onChangeText={t => setPin(t.replace(/\D/g, ''))}
          placeholder="PIN"
          placeholderTextColor={colors.textFaint}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={6}
          style={{
            backgroundColor: colors.elevated,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 10,
            paddingHorizontal: 16,
            paddingVertical: 14,
            color: colors.text,
            fontSize: 15,
            letterSpacing: 4,
            marginBottom: 16,
          }}
        />

        {error ? (
          <Text style={{ color: colors.red, fontSize: 13, marginBottom: 12 }}>{error}</Text>
        ) : null}

        {/* Submit */}
        <TouchableOpacity
          onPress={handleLogin}
          disabled={loading || !name.trim() || !pin.trim()}
          activeOpacity={0.8}
          style={{
            backgroundColor: colors.white,
            borderRadius: 10,
            paddingVertical: 14,
            alignItems: 'center',
            opacity: loading || !name.trim() || !pin.trim() ? 0.3 : 1,
          }}
        >
          {loading ? (
            <ActivityIndicator color={colors.black} />
          ) : (
            <Text style={{ color: colors.black, fontSize: 15, fontWeight: '600' }}>Sign In</Text>
          )}
        </TouchableOpacity>

        {/* Signup link */}
        <Link href="/(auth)/signup" asChild>
          <TouchableOpacity style={{ marginTop: 20, alignItems: 'center' }}>
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>
              New here? <Text style={{ color: colors.blue }}>Create an account</Text>
            </Text>
          </TouchableOpacity>
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}
