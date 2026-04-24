import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useAuth } from "../src/auth";
import { colors } from "../src/theme";

export default function Index() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <View style={styles.container} testID="bootstrap-loader">
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  return <Redirect href={user ? "/(tabs)/home" : "/login"} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.appBg,
  },
});
