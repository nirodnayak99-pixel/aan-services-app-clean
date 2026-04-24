import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState, useEffect } from "react";
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
  const [showFilter, setShowFilter] = useState(false);

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
    setLoading(true); // 👈 ADD THIS

    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (filterIndustry) params.set("industry_id", filterIndustry);

    const qs = params.toString();

    const [list, inds] = await Promise.all([
      apiRequest<EmployeeListItem[]>(`/employees${qs ? `?${qs}` : ""}`),
      apiRequest<Industry[]>("/industries"),
    ]);

    setEmployees(list);
    setIndustries(inds);
  } finally {
    setLoading(false);
    setRefreshing(false);
  }
}, [query, filterIndustry]);

  

  useEffect(() => {
  const delay = setTimeout(() => {
    load();
  }, 400);

  return () => clearTimeout(delay);
}, [query, filterIndustry]); 

const selectedIndustryName =
  industries.find(i => i.id === filterIndustry)?.name || "All Industries";
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Employees</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
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

      <View style={styles.filterBar}>
       <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            testID="employees-search-input"
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search employees..."
            placeholderTextColor={colors.textMuted}
            returnKeyType="search"
            
          />
        </View>

  <TouchableOpacity
  style={styles.dropdown}
  onPress={() => setShowFilter(true)}
>
  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
  <Text style={styles.dropdownText}>{selectedIndustryName}</Text>
  <Ionicons name="chevron-down" size={14} color={colors.textSecondary} />
  </View>
</TouchableOpacity>
</View>

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

  ListHeaderComponent={
    loading ? (
      <ActivityIndicator
        color={colors.primary}
        style={{ marginVertical: 20 }}
      />
    ) : null
  }

  ListEmptyComponent={
  loading ? null : (
    <View style={styles.empty}>
      <Ionicons
        name="people-outline"
        size={40}
        color={colors.textMuted}
      />
      <Text style={styles.emptyTitle}>No employees found</Text>
      <Text style={styles.emptyText}>
        {query || filterIndustry
          ? "No matching employees found"
          : "Tap the + button to onboard the first employee"}
      </Text>
    </View>
  )
}

  renderItem={({ item }) => (
    <TouchableOpacity
      testID={`employee-row-${item.id}`}
      style={styles.card}
      onPress={() => router.push(`/employee/${item.id}`)}
    >
      <View style={styles.cardTop}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {item.name.charAt(0).toUpperCase()}
          </Text>
        </View>

        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.meta}>{item.phone}</Text>
          {item.designation ? (
            <Text style={styles.meta}>{item.designation}</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.cardBottom}>
        <Text style={styles.industry}>{item.industry_name}</Text>
      </View>
    </TouchableOpacity>
  )}
/>
      {showFilter && (
  <View style={styles.filterModal}>
    <TouchableOpacity
      style={styles.filterBackdrop}
      onPress={() => setShowFilter(false)}
    />

    <View style={styles.filterSheet}>
      <Text style={styles.filterTitle}>Select Industry</Text>

      <TouchableOpacity
        style={styles.filterItem}
        onPress={() => {
          setFilterIndustry(null);
          setShowFilter(false);
        }}
      >
        <Text>All Industries</Text>
      </TouchableOpacity>

      {industries.map((i) => (
        <TouchableOpacity
          key={i.id}
          style={styles.filterItem}
          onPress={() => {
            setFilterIndustry(i.id);
            setShowFilter(false);
            
          }}
        >
          <Text>{i.name}</Text>
        </TouchableOpacity>
      ))}
    </View>
  </View>
)}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  filterModal: {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  justifyContent: "flex-end",
},

filterBackdrop: {
  ...StyleSheet.absoluteFillObject,
  backgroundColor: "rgba(0,0,0,0.3)",
},

filterSheet: {
  backgroundColor: colors.surface,
  padding: 20,
  borderTopLeftRadius: 20,
  borderTopRightRadius: 20,
},

filterTitle: {
  fontWeight: "700",
  fontSize: 16,
  marginBottom: 10,
},

filterItem: {
  paddingVertical: 12,
},
  filterBar: {
  flexDirection: "row",
  gap: 10,
  paddingHorizontal: 20,
  marginBottom: 10,
},

searchBox: {
  flex: 1,
  flexDirection: "row",
  alignItems: "center",
  backgroundColor: colors.surface,
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: radius.input,
  paddingHorizontal: 12,
  gap: 8,
},

dropdown: {
  paddingHorizontal: 12,
  justifyContent: "center",
  backgroundColor: colors.slate100,
  borderRadius: radius.input,
},

dropdownText: {
  fontSize: 12,
  fontWeight: "600",
  color: colors.textSecondary,
},

card: {
  backgroundColor: colors.surface,
  borderRadius: 14,
  padding: 16, // 👈 increased
  borderWidth: 1,
  borderColor: colors.borderLight,
  marginBottom: 12,
},

cardTop: {
  flexDirection: "row",
  alignItems: "center",
},

cardBottom: {
  marginTop: 10,
  borderTopWidth: 1,
  borderTopColor: colors.borderLight,
  paddingTop: 8,
},

industry: {
  fontSize: 12,
  color: "#fff",
  fontWeight: "600",
  backgroundColor: colors.primary,
  paddingHorizontal: 10,
  paddingVertical: 4,
  borderRadius: 999,
  alignSelf: "flex-start",
},
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
  
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.textPrimary,
  },
  
  list: { paddingHorizontal: 20, paddingBottom: 40, gap: 10 },
  
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.slate100,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.primary, fontWeight: "700", fontSize: 17 },
  name: { fontSize: 16, fontWeight: "700", color: colors.textPrimary },
  meta: { fontSize: 12, color: colors.textSecondary, opacity: 0.8 },
  
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
