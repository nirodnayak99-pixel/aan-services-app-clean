import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiRequest, Employee, Industry } from "../../../src/api";
import { colors, radius, spacing } from "../../../src/theme";

type FormState = {
  name: string;
  phone: string;
  email: string;
  address: string;
  dob: string;
  joining_date: string;
  designation: string;
  salary: string;
  industry_id: string | null;
  aadhaar_image_base64: string | null;
};

export default function EditEmployeeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [industryPickerOpen, setIndustryPickerOpen] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [emp, inds] = await Promise.all([
          apiRequest<Employee>(`/employees/${id}`),
          apiRequest<Industry[]>("/industries"),
        ]);
        setIndustries(inds);
        setForm({
          name: emp.name ?? "",
          phone: emp.phone ?? "",
          email: emp.email ?? "",
          address: emp.address ?? "",
          dob: emp.dob ?? "",
          joining_date: emp.joining_date ?? "",
          designation: emp.designation ?? "",
          salary: emp.salary != null ? String(emp.salary) : "",
          industry_id: emp.industry_id,
          aadhaar_image_base64: emp.aadhaar_image_base64,
        });
      } catch (e: any) {
        Alert.alert("Error", e?.message ?? "Failed to load employee");
        router.back();
      } finally {
        setLoading(false);
      }
    })();
  }, [id, router]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => (f ? { ...f, [k]: v } : f));

  const pickFromGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission required", "Gallery access was denied.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
      base64: true,
    });
    if (!res.canceled && res.assets[0]?.base64) {
      set(
        "aadhaar_image_base64",
        `data:image/jpeg;base64,${res.assets[0].base64}`
      );
    }
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission required", "Camera access was denied.");
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.7,
      base64: true,
    });
    if (!res.canceled && res.assets[0]?.base64) {
      set(
        "aadhaar_image_base64",
        `data:image/jpeg;base64,${res.assets[0].base64}`
      );
    }
  };

  const onSave = async () => {
    if (!form) return;
    if (!form.name.trim()) return Alert.alert("Missing info", "Name is required");
    if (!form.phone.trim()) return Alert.alert("Missing info", "Phone is required");
    if (!form.industry_id) return Alert.alert("Missing info", "Industry is required");
    if (!form.aadhaar_image_base64)
      return Alert.alert("Missing info", "Aadhaar photo is required");
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email))
      return Alert.alert("Invalid", "Email is invalid");

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        industry_id: form.industry_id,
        aadhaar_image_base64: form.aadhaar_image_base64,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        dob: form.dob.trim() || null,
        joining_date: form.joining_date.trim() || null,
        designation: form.designation.trim() || null,
        salary: form.salary.trim() ? parseFloat(form.salary) : null,
      };
      // Remove null-valued fields so backend treats as "no change" (EmployeeUpdate skips None via exclude_unset+filter)
      const clean: Record<string, unknown> = {};
      Object.entries(payload).forEach(([k, v]) => {
        if (v !== null && v !== undefined) clean[k] = v;
      });
      await apiRequest(`/employees/${id}`, { method: "PUT", body: clean });
      Alert.alert("Saved", "Employee updated", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !form) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  const selectedIndustry = industries.find((i) => i.id === form.industry_id);

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.section}>Personal Information</Text>
          <Field
            label="FULL NAME *"
            value={form.name}
            onChangeText={(t) => set("name", t)}
            testID="edit-emp-name"
          />
          <Field
            label="PHONE *"
            value={form.phone}
            onChangeText={(t) => set("phone", t)}
            keyboardType="phone-pad"
            testID="edit-emp-phone"
          />
          <Field
            label="EMAIL"
            value={form.email}
            onChangeText={(t) => set("email", t)}
            keyboardType="email-address"
            testID="edit-emp-email"
          />
          <Field
            label="ADDRESS"
            value={form.address}
            onChangeText={(t) => set("address", t)}
            multiline
            testID="edit-emp-address"
          />
          <Field
            label="DATE OF BIRTH"
            value={form.dob}
            onChangeText={(t) => set("dob", t)}
            placeholder="YYYY-MM-DD"
            testID="edit-emp-dob"
          />

          <Text style={[styles.section, { marginTop: spacing.lg }]}>
            Job Details
          </Text>
          <Field
            label="DESIGNATION"
            value={form.designation}
            onChangeText={(t) => set("designation", t)}
            testID="edit-emp-designation"
          />
          <Field
            label="JOINING DATE"
            value={form.joining_date}
            onChangeText={(t) => set("joining_date", t)}
            placeholder="YYYY-MM-DD"
            testID="edit-emp-joining"
          />
          <Field
            label="MONTHLY SALARY (INR)"
            value={form.salary}
            onChangeText={(t) => set("salary", t)}
            keyboardType="numeric"
            testID="edit-emp-salary"
          />

          <Text style={styles.label}>INDUSTRY *</Text>
          <TouchableOpacity
            testID="edit-emp-industry-picker"
            style={styles.pickerBtn}
            onPress={() => setIndustryPickerOpen(true)}
          >
            <Text
              style={[
                styles.pickerText,
                !selectedIndustry && { color: colors.textMuted },
              ]}
            >
              {selectedIndustry ? selectedIndustry.name : "Select industry"}
            </Text>
            <Ionicons
              name="chevron-down"
              size={18}
              color={colors.textSecondary}
            />
          </TouchableOpacity>

          <Text style={[styles.section, { marginTop: spacing.lg }]}>
            Aadhaar Card Photo *
          </Text>
          <View style={styles.aadhaarBox}>
            {form.aadhaar_image_base64 ? (
              <Image
                source={{ uri: form.aadhaar_image_base64 }}
                style={styles.aadhaarImg}
              />
            ) : null}
            <View style={styles.aadhaarActions}>
              <TouchableOpacity
                testID="edit-aadhaar-camera-btn"
                style={[styles.secondaryBtn, { flex: 1 }]}
                onPress={takePhoto}
              >
                <Ionicons name="camera" size={18} color={colors.primary} />
                <Text style={styles.secondaryText}>Retake</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="edit-aadhaar-gallery-btn"
                style={[styles.secondaryBtn, { flex: 1 }]}
                onPress={pickFromGallery}
              >
                <Ionicons name="images" size={18} color={colors.primary} />
                <Text style={styles.secondaryText}>From Gallery</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            testID="edit-emp-save-btn"
            style={[styles.saveBtn, saving && { opacity: 0.7 }]}
            onPress={onSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={industryPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIndustryPickerOpen(false)}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => setIndustryPickerOpen(false)}
        />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Select Industry</Text>
          <ScrollView style={{ maxHeight: 360 }}>
            {industries.map((i) => (
              <TouchableOpacity
                key={i.id}
                testID={`edit-industry-option-${i.id}`}
                style={styles.option}
                onPress={() => {
                  set("industry_id", i.id);
                  setIndustryPickerOpen(false);
                }}
              >
                <Text style={styles.optionText}>{i.name}</Text>
                {form.industry_id === i.id && (
                  <Ionicons name="checkmark" size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Field({
  label,
  testID,
  multiline,
  ...rest
}: {
  label: string;
  testID: string;
  multiline?: boolean;
} & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        testID={testID}
        style={[
          styles.input,
          multiline && { minHeight: 80, textAlignVertical: "top" },
        ]}
        placeholderTextColor={colors.textMuted}
        multiline={multiline}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.appBg },
  scroll: { padding: 20, paddingBottom: 40 },
  section: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary,
    marginBottom: 10,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    color: colors.slate500,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.input,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.textPrimary,
  },
  pickerBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.input,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pickerText: { fontSize: 15, color: colors.textPrimary },
  aadhaarBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: 12,
  },
  aadhaarImg: {
    width: "100%",
    height: 200,
    borderRadius: radius.image,
    backgroundColor: colors.slate100,
    resizeMode: "cover",
  },
  aadhaarActions: { flexDirection: "row", gap: 10, marginTop: 12 },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    backgroundColor: colors.slate100,
    borderRadius: radius.button,
  },
  secondaryText: { color: colors.primary, fontWeight: "600", fontSize: 13 },
  saveBtn: {
    marginTop: spacing.xl,
    backgroundColor: colors.primary,
    borderRadius: radius.button,
    paddingVertical: 14,
    alignItems: "center",
  },
  saveText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 32,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.slate200,
    marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 10,
  },
  option: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  optionText: { fontSize: 15, color: colors.textPrimary },
});
