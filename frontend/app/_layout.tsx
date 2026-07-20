import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { LogBox } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { AuthProvider } from "@/src/context/AuthContext";
import { AppProvider } from "@/src/context/AppContext";
import { AccessProvider } from "@/src/context/AccessContext";
LogBox.ignoreAllLogs(true);
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useIconFonts();

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <AccessProvider>
          <AppProvider>
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#FFFFFF" } }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="login" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="add-medication" options={{ presentation: "modal" }} />
              <Stack.Screen name="add-patient" options={{ presentation: "modal" }} />
              <Stack.Screen name="sos" options={{ presentation: "modal", animation: "fade" }} />
              <Stack.Screen name="device" />
              <Stack.Screen name="device-diagnostics" />
              <Stack.Screen name="pairing" options={{ presentation: "modal" }} />
              <Stack.Screen name="safety" />
              <Stack.Screen name="allergies" options={{ presentation: "modal" }} />
              <Stack.Screen name="scan-prescription" options={{ presentation: "fullScreenModal", animation: "slide_from_bottom" }} />
              <Stack.Screen name="scan-barcode" options={{ presentation: "fullScreenModal", animation: "slide_from_bottom" }} />
            </Stack>
          </AppProvider>
         </AccessProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
