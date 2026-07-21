import React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  View,
} from "react-native";
import { Redirect } from "expo-router";

import { useAuth } from "@/src/context/AuthContext";
import { useAccess } from "@/src/context/AccessContext";
import { colors } from "@/src/theme";
import { VLogo } from "@/src/components/ui";

export default function Index() {
  const {
    user,
    loading: authLoading,
  } = useAuth();

  const {
    isAccessAuthenticated,
    loading: accessLoading,
  } = useAccess();

  if (authLoading || accessLoading) {
    return (
      <View style={styles.container} testID="splash-loading">
        <VLogo size={72} />

        <ActivityIndicator
          color={colors.brandPrimary}
          style={styles.loader}
          size="large"
        />
      </View>
    );
  }

  if (!user) {
    return <Redirect href={"/login" as any} />;
  }

  if (!isAccessAuthenticated) {
    return <Redirect href={"/access-login" as any} />;
  }

  return <Redirect href={"/(tabs)" as any} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceInverse,
    alignItems: "center",
    justifyContent: "center",
  },

  loader: {
    marginTop: 24,
  },
});
