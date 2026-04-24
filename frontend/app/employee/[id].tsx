import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiRequest, Employee } from "../../src/api";
import { useAuth } from "../../src/auth";
import { shareEmployeePdf } from "../../src/share";
import { colors, radius, spacing } from "../../src/theme";

export default function EmployeeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [emp, setEmp] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharingPdf, setSharingPdf] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const e = await apiRequest<Employee>(`/employees/${id}`);
      console.log("EMP DETAIL:", e);
      setEmp(e);
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed to load employee");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const onDelete = () => {
    Alert.alert("Delete Employee", `Remove ${emp?.name}? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await apiRequest(`/employees/${id}`, { method: "DELETE" });
            router.back();
          } catch (e: any) {
            Alert.alert("Error", e?.message ?? "Failed");
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator
          color={colors.primary}
          style={{ marginTop: 40 }}
        />
      </SafeAreaView>
    );
  }
  if (!emp) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.missing}>Employee not found.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.heroCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {emp.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.name} testID="emp-detail-name">
            {emp.name}
          </Text>
          {emp.designation ? (
            <Text style={styles.designation}>{emp.designation}</Text>
          ) : null}
          <View style={styles.industryPill}>
            <Ionicons name="business" size={12} color="#fff" />
            <Text style={styles.industryText}>{emp.industry_name}</Text>
          </View>
        </View>

        <InfoSection title="Contact">
          <InfoRow icon="call" label="Phone" value={emp.phone} />
          <InfoRow icon="mail" label="Email" value={emp.email ?? "—"} />
          <InfoRow icon="location" label="Address" value={emp.address ?? "—"} />
        </InfoSection>

        <InfoSection title="Employment">
          <InfoRow icon="calendar" label="Date of Birth" value={emp.dob ?? "—"} />
          <InfoRow
            icon="enter"
            label="Joining Date"
            value={emp.joining_date ?? "—"}
          />
          <InfoRow
            icon="cash"
            label="Salary"
            value={emp.salary != null ? `₹ ${emp.salary.toLocaleString("en-IN")}` : "—"}
          />
        </InfoSection>

        <Text style={styles.sectionTitle}>Aadhaar Card</Text>
        <View style={styles.aadhaarCard}>
          {emp.aadhaar_image_url ? (
            <Image
              testID="emp-detail-aadhaar"
              source={{ uri: emp.aadhaar_image_url }}
              style={styles.aadhaarImg}
              resizeMode="contain"
            />
          ) : (
            <Text style={{ textAlign: "center", color: "#999" }}>
              No Aadhaar image available
            </Text>
          )}
        </View>

        <TouchableOpacity
          testID="emp-detail-share-pdf-btn"
          style={[styles.shareBtn, sharingPdf && { opacity: 0.7 }]}
          disabled={sharingPdf}
          onPress={async () => {
            if (!emp) return;
            setSharingPdf(true);
            try {
              await shareEmployeePdf(emp);
            } catch (e: any) {
              Alert.alert("PDF error", e?.message ?? "Failed to generate PDF");
            } finally {
              setSharingPdf(false);
            }
          }}
        >
          {sharingPdf ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="share-outline" size={18} color="#fff" />
              <Text style={styles.shareText}>Share Onboarding PDF</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          testID="emp-detail-edit-btn"
          style={styles.editBtn}
          onPress={() => router.push(`/employee/edit/${emp.id}`)}
        >
          <Ionicons name="pencil" size={18} color={colors.primary} />
          <Text style={styles.editText}>Edit Employee</Text>
        </TouchableOpacity>

        {isAdmin ? (
          <TouchableOpacity
            testID="emp-detail-delete-btn"
            style={styles.deleteBtn}
            onPress={onDelete}
          >
            <Ionicons name="trash" size={18} color={colors.danger} />
            <Text style={styles.deleteText}>Delete Employee</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginTop: spacing.lg }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.infoCard}>{children}</View>
    </View>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={16} color={colors.primary} />
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.appBg },
  scroll: { padding: 20, paddingBottom: 40 },
  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontSize: 28, fontWeight: "700" },
  name: {
    marginTop: 12,
    fontSize: 20,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  designation: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  industryPill: {
    marginTop: 10,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  industryText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    color: colors.slate500,
    marginTop: spacing.lg,
    marginBottom: 8,
  },
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: 16,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  infoLabel: { fontSize: 11, color: colors.textMuted, fontWeight: "600" },
  infoValue: { fontSize: 14, color: colors.textPrimary, marginTop: 2 },
  aadhaarCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: 12,
  },
  aadhaarImg: {
    width: "100%",
    height: 240,
    borderRadius: radius.image,
    backgroundColor: colors.slate100,
  },
  deleteBtn: {
    marginTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  deleteText: { color: colors.danger, fontWeight: "700", fontSize: 14 },
  shareBtn: {
    marginTop: spacing.xl,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: radius.button,
    backgroundColor: colors.primary,
  },
  shareText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  editBtn: {
    marginTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: radius.button,
    backgroundColor: colors.slate100,
  },
  editText: { color: colors.primary, fontWeight: "700", fontSize: 14 },
  missing: { textAlign: "center", color: colors.textSecondary, padding: 40 },
});
