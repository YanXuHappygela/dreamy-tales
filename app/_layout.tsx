import "../global.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { trpc, createTRPCClient } from "@/lib/trpc";
import { ThemeProvider } from "@/lib/theme-provider";
import { initManusRuntime, subscribeSafeAreaInsets } from "@/lib/_core/manus-runtime";

// Guard against SSR / server-side rendering where window is not available
if (typeof window !== "undefined") {
  initManusRuntime();
  if (Platform.OS === "web") {
    subscribeSafeAreaInsets(() => {});
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

const trpcClient = createTRPCClient();

export default function RootLayout() {
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      appState.current = nextAppState;
    });
    return () => subscription.remove();
  }, []);

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider forcedColorScheme="dark">
          <SafeAreaProvider>
            <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#0D0B2B" }}>
              <StatusBar style="light" backgroundColor="#0D0B2B" />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: "#0D0B2B" },
                  animation: "fade",
                }}
              >
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen
                  name="config"
                  options={{
                    headerShown: false,
                    animation: "slide_from_bottom",
                    presentation: "modal",
                  }}
                />
                <Stack.Screen
                  name="story"
                  options={{
                    headerShown: false,
                    animation: "slide_from_right",
                  }}
                />
              </Stack>
            </GestureHandlerRootView>
          </SafeAreaProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
