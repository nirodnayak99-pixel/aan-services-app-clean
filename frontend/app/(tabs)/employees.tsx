import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiRequest, downloadCsv, EmployeeListItem, Industry } from "../../src/api";
import { shareCsvFile } from "../../src/share";
import { colors, radius, spacing } from "../../src/theme";

export default function EmployeesScreen() {
  const router = useRouter();
  const [employees, setEmployees] = useState<EmployeeListItem[]>([]);
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [query, setQuery] = useState("");
  const [filterIndustry, setFilterIndustry] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const onExportCsv = async () => {
    setExporting(true);
    try {
      const { text, filename } = await downloadCsv(filterIndustry);
      await shareCsvFile(text, filename);
    } catch (e: any) {
      Alert.alert("Export failed", e?.message ?? "Please try again");
    } finally {
      setExporting(false);
    }
  };

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (filterIndustry) params.set("industry_id", filterIndustry);
      const qs = params.toString();
      const [list, inds] = await Promise.all([
        apiRequest<EmployeeListItem[]>(`/employees${qs ? `?${qs}` : ""}`),
        apiRequest<Industry[]>("/industries"),
      ]);

      console.log("EMPLOYEES LIST:", list);
      setEmployees(list);
      setIndustries(inds);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [query, filterIndustry]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const filterChips = useMemo(
    () => [{ id: null, name: "All" }, ...industries.map((i) => ({ id: i.id, name: i.name }))],
    [industries]
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Employees</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity
            testID="employees-export-csv-btn"
            style={styles.iconBtnSecondary}
            onPress={onExportCsv}
            disabled={exporting}
          >
            {exporting ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons
                name="download-outline"
                size={20}
                color={colors.primary}
              />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            testID="employees-add-btn"
            style={styles.addBtn}
            onPress={() => router.push("/employee/new")}
          >
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          testID="employees-search-input"
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search by name, phone, designation"
          placeholderTextColor={colors.textMuted}
          returnKeyType="search"
          onSubmitEditing={load}
        />
      </View>

      <FlatList
        horizontal
        data={filterChips}
        keyExtractor={(i) => String(i.id)}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        renderItem={({ item }) => {
          const active = filterIndustry === item.id;
          return (
            <TouchableOpacity
              testID={`chip-${item.id ?? "all"}`}
              onPress={() => setFilterIndustry(item.id)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {item.name}
              </Text>
            </TouchableOpacity>
          );
        }}
      />

      {loading ? (
        <ActivityIndicator
          color={colors.primary}
          style={{ marginTop: 40 }}
        />
      ) : (
        <FlatList
          data={employees}
          keyExtractor={(e) => e.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons
                name="people-outline"
                size={40}
                color={colors.textMuted}
              />
              <Text style={styles.emptyTitle}>No employees found</Text>
              <Text style={styles.emptyText}>
                Tap the + button to onboard the first employee
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              testID={`employee-row-${item.id}`}
              style={styles.row}
              onPress={() => router.push(`/employee/${item.id}`)}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {item.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.meta}>
                  {item.designation ? `${item.designation} · ` : ""}
                  {item.phone}
                </Text>
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.industry_name}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.appBg },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  title: { fontSize: 24, fontWeight: "700", color: colors.textPrimary },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnSecondary: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.slate100,
    alignItems: "center",
    justifyContent: "center",
  },
  searchWrap: {
    marginHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.input,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.textPrimary,
  },
  chips: { paddingHorizontal: 20, paddingVertical: 12, gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12, color: colors.textSecondary, fontWeight: "600" },
  chipTextActive: { color: "#fff" },
  list: { paddingHorizontal: 20, paddingBottom: 40, gap: 10 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.slate100,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.primary, fontWeight: "700", fontSize: 17 },
  name: { fontSize: 15, fontWeight: "600", color: colors.textPrimary },
  meta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  badge: {
    backgroundColor: colors.slate100,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    maxWidth: 130,
  },
  badgeText: {
    fontSize: 11,
    color: colors.slate600,
    fontWeight: "600",
  },
  empty: { padding: spacing.xl, alignItems: "center" },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
    marginTop: 10,
  },
  emptyText: {
    color: colors.textMuted,
    textAlign: "center",
    marginTop: 4,
    fontSize: 13,
  },
});
