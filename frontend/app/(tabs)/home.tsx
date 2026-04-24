import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiRequest, Stats } from "../../src/api";
import { useAuth } from "../../src/auth";
import { colors, radius, spacing } from "../../src/theme";

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = await apiRequest<Stats>("/stats");
      setStats(s);
    } catch {
      // handled by error UI in future
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.hi} testID="home-greeting">
              Hello, {user?.name ?? "Admin"}
            </Text>
            <Text style={styles.brand}>AAN Services Dashboard</Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator
            color={colors.primary}
            style={{ marginTop: 40 }}
          />
        ) : (
          <>
            <View style={styles.grid}>
              <View style={[styles.statCard, styles.statCardPrimary]}>
                <Ionicons name="people" size={22} color="#fff" />
                <Text style={styles.statLabelLight}>TOTAL EMPLOYEES</Text>
                <Text
                  style={styles.statValueLight}
                  testID="stat-total-employees"
                >
                  {stats?.total_employees ?? 0}
                </Text>
              </View>
              <View style={[styles.statCard, styles.statCardLight]}>
                <Ionicons name="business" size={22} color={colors.primary} />
                <Text style={styles.statLabel}>INDUSTRIES</Text>
                <Text style={styles.statValue} testID="stat-total-industries">
                  {stats?.total_industries ?? 0}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              testID="home-onboard-btn"
              style={styles.ctaBtn}
              onPress={() => router.push("/employee/new")}
            >
              <Ionicons name="add-circle" size={20} color="#fff" />
              <Text style={styles.ctaText}>Onboard New Employee</Text>
            </TouchableOpacity>

            <Text style={styles.sectionTitle}>Recent Onboardings</Text>
            <View style={styles.recentCard}>
              {stats && stats.recent_employees.length > 0 ? (
                stats.recent_employees.map((e, idx) => (
                  <TouchableOpacity
                    key={e.id}
                    testID={`recent-employee-${e.id}`}
                    style={[
                      styles.recentRow,
                      idx < stats.recent_employees.length - 1 && styles.rowDivider,
                    ]}
                    onPress={() => router.push(`/employee/${e.id}`)}
                  >
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {e.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.empName}>{e.name}</Text>
                      <Text style={styles.empMeta}>
                        {e.designation ?? "—"}
                      </Text>
                    </View>
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{e.industry_name}</Text>
                    </View>
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.empty}>
                  <Ionicons
                    name="people-outline"
                    size={36}
                    color={colors.textMuted}
                  />
                  <Text style={styles.emptyText}>No employees onboarded yet</Text>
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.appBg },
  scroll: { padding: 20, paddingBottom: 40 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  hi: { color: colors.textSecondary, fontSize: 14 },
  brand: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.textPrimary,
    marginTop: 4,
    letterSpacing: -0.4,
  },
  grid: { flexDirection: "row", gap: 12 },
  statCard: {
    flex: 1,
    borderRadius: radius.card,
    padding: 16,
    minHeight: 110,
    justifyContent: "space-between",
  },
  statCardPrimary: { backgroundColor: colors.primary },
  statCardLight: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.slate500,
    letterSpacing: 0.5,
  },
  statLabelLight: {
    fontSize: 10,
    fontWeight: "700",
    color: "rgba(255,255,255,0.75)",
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  statValueLight: { fontSize: 28, fontWeight: "700", color: "#fff" },
  ctaBtn: {
    marginTop: 16,
    backgroundColor: colors.accent,
    paddingVertical: 14,
    borderRadius: radius.button,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  ctaText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  sectionTitle: {
    marginTop: 24,
    marginBottom: 10,
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  recentCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: "hidden",
  },
  recentRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.slate100,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: colors.primary,
    fontWeight: "700",
    fontSize: 16,
  },
  empName: { fontSize: 15, fontWeight: "600", color: colors.textPrimary },
  empMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  badge: {
    backgroundColor: colors.slate100,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 11,
    color: colors.slate600,
    fontWeight: "600",
  },
  empty: { padding: 32, alignItems: "center" },
  emptyText: {
    color: colors.textMuted,
    marginTop: 8,
    fontSize: 13,
  },
});
