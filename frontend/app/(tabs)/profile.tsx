import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  Alert,
  Image,
  Linking,
  StyleSheet,
  Text,
  Pressable,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../src/auth";
import { colors, radius, spacing } from "../../src/theme";

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const confirmLogout = () => {
    console.log("Logout button clicked");
    Alert.alert("Logout", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          console.log("Logout confirmed");
          await logout();
          router.replace("/login");
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.logoWrap}>
          <Image
            source={{
              uri: "https://img1.wsimg.com/isteam/ip/c4c9e109-b5b2-4745-851e-8f937ee2d4d0/project_20260203_0524580-01.png",
            }}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.userName} testID="profile-name">
          {user?.name ?? "Admin"}
        </Text>
        <Text style={styles.userEmail} testID="profile-email">
          {user?.email}
        </Text>
        <View style={styles.rolePill}>
          <Text style={styles.roleText}>{user?.role?.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.section}>
        {user?.role === "admin" ? (
          <TouchableOpacity
            testID="profile-manage-users"
            style={[styles.row, { marginBottom: 10 }]}
            onPress={() => router.push("/users")}
          >
            <Ionicons
              name="people-circle-outline"
              size={20}
              color={colors.primary}
            />
            <Text style={styles.rowText}>Manage Users</Text>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={colors.textMuted}
            />
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          testID="profile-open-website"
          style={styles.row}
          onPress={() => Linking.openURL("https://aanservices.in")}
        >
          <Ionicons name="open-outline" size={20} color={colors.primary} />
          <Text style={styles.rowText}>Open aanservices.in in browser</Text>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={colors.textMuted}
          />
        </TouchableOpacity>
      </View>

        <Pressable
          testID="profile-logout-btn"
          style={styles.logoutBtn}
          onPress={confirmLogout}
        >
        <Ionicons name="log-out-outline" size={20} color={colors.danger} />
        <Text style={styles.logoutText}>Sign Out</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.appBg },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  title: { fontSize: 24, fontWeight: "700", color: colors.textPrimary },
  card: {
    marginHorizontal: 20,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  logoWrap: {
    width: 80,
    height: 80,
    borderRadius: 18,
    backgroundColor: colors.slate50,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: { width: 54, height: 54 },
  userName: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  userEmail: { color: colors.textSecondary, fontSize: 13, marginTop: 4 },
  rolePill: {
    marginTop: 10,
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  roleText: { color: "#fff", fontWeight: "700", fontSize: 11, letterSpacing: 0.5 },
  section: { marginTop: 16, marginHorizontal: 20 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  rowText: { flex: 1, fontSize: 14, color: colors.textPrimary },
  logoutBtn: {
    marginTop: spacing.lg,
    marginHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: radius.button,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  logoutText: { color: colors.danger, fontWeight: "700", fontSize: 15 },
});
