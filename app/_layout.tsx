import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { initializeDatabase } from '@/db/client';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [appIsReady, setAppIsReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [initAttempt, setInitAttempt] = useState(0);

  useEffect(() => {
    async function prepare() {
      try {
        setInitError(null);
        await initializeDatabase();
        setAppIsReady(true);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown database error';
        console.error('Database initialization failed:', error);
        setAppIsReady(false);
        setInitError(message);
      }
    }

    prepare();
  }, [initAttempt]);

  if (!appIsReady) {
    if (initError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Database initialization failed</Text>
          <Text style={styles.errorMessage}>{initError}</Text>
          <Pressable
            onPress={() => {
              setAppIsReady(false);
              setInitError(null);
              setInitAttempt((value) => value + 1);
            }}
            style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
          <StatusBar style="auto" />
        </View>
      );
    }

    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="upload" options={{ headerShown: false }} />
        <Stack.Screen name="categories" options={{ headerShown: false }} />
        <Stack.Screen name="monthly-category-stats" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
    backgroundColor: '#fff',
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#11181C',
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 15,
    lineHeight: 22,
    color: '#687076',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 8,
    borderRadius: 8,
    backgroundColor: '#11181C',
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
