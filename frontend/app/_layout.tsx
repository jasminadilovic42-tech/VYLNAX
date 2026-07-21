import React, { useEffect } from "react";
import {
  ActivityIndicator,
  Platform,
  View,
} from "react-native";
import {
  Redirect,
  Tabs,
} from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";

import { colors } from "@/src/theme";
import { useAccess } from "@/src/context/AccessContext";

export default function TabsLayout() {
  const {
    isAccessAuthenticated,
    loading: accessLoading,
  } = useAccess();

  useEffect(() => {
    if (
      accessLoading ||
      !isAccessAuthenticated
    ) {
      return;
    }

    const welcomeTimer = setTimeout(() => {
      Speech.speak(
        "Willkommen bei VYLNAX Pro. Wie kann ich Ihnen helfen?",
        {
          language: "de-DE",
          rate: 0.95,
          pitch: 1.0,
        }
      );
    }, 1200);

    return () => {
      clearTimeout(welcomeTimer);
      Speech.stop();
    };
  }, [
    accessLoading,
    isAccessAuthenticated,
  ]);

  if (accessLoading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.surface,
        }}
      >
        <ActivityIndicator
          size="large"
          color={colors.brandPrimary}
        />
      </View>
    );
  }

  if (!isAccessAuthenticated) {
    return (
      <Redirect href="/access-login" />
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor:
          colors.brandPrimary,
        tabBarInactiveTintColor:
          colors.borderStrong,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height:
            Platform.OS === "ios"
              ? 88
              : 64,
          paddingTop: 6,
          paddingBottom:
            Platform.OS === "ios"
              ? 28
              : 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
      }}
      screenListeners={{
        tabPress: () => {
          if (Platform.OS !== "web") {
            void Haptics.selectionAsync();
          }
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Übersicht",
          tabBarIcon: ({
            color,
            size,
          }) => (
            <Ionicons
              name="home"
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="plan"
        options={{
          title: "Plan",
          tabBarIcon: ({
            color,
            size,
          }) => (
            <Ionicons
              name="medkit"
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="assistant"
        options={{
          title: "Assistent",
          tabBarIcon: ({
            color,
            size,
          }) => (
            <Ionicons
              name="sparkles"
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="reports"
        options={{
          title: "Berichte",
          tabBarIcon: ({
            color,
            size,
          }) => (
            <Ionicons
              name="bar-chart"
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          tabBarIcon: ({
            color,
            size,
          }) => (
            <Ionicons
              name="person"
              size={size}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}