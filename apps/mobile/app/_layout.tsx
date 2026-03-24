import { useEffect, useState, useCallback } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { AuthContext, User, loginAction, registerAction, checkAuthAction, logoutAction } from '../src/store/auth';
import { colors } from '../src/theme/colors';

export default function RootLayout() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const segments = useSegments();

  // Check auth on mount
  useEffect(() => {
    checkAuthAction().then(u => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  // Redirect based on auth state
  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!user && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [user, segments, loading]);

  const login = useCallback(async (name: string, pin: string) => {
    const result = await loginAction(name, pin);
    if (result) {
      setUser(result.user);
      setTokenState(result.token);
      return true;
    }
    return false;
  }, []);

  const register = useCallback(async (name: string, pin: string, area: string, phone?: string) => {
    const result = await registerAction(name, pin, area, phone);
    if (result) {
      setUser(result.user);
      setTokenState(result.token);
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(async () => {
    await logoutAction();
    setUser(null);
    setTokenState(null);
  }, []);

  const checkAuth = useCallback(async () => {
    const u = await checkAuthAction();
    setUser(u);
    return !!u;
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={colors.textMuted} />
      </View>
    );
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, checkAuth }}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'fade',
        }}
      />
    </AuthContext.Provider>
  );
}
