import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
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
import { apiRequest, Industry } from "../../src/api";
import { colors, radius, spacing } from "../../src/theme";

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

const initial: FormState = {
  name: "",
  phone: "",
  email: "",
  address: "",
  dob: "",
  joining_date: "",
  designation: "",
  salary: "",
  industry_id: null,
  aadhaar_image_base64: null,
};

export default function NewEmployeeScreen() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initial);
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [industryPickerOpen, setIndustryPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiRequest<Industry[]>("/industries")
      .then(setIndustries)
      .catch(() => {});
  }, []);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

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

  const selectedIndustry = industries.find((i) => i.id === form.industry_id);

  const validate = (): string | null => {
    if (!form.name.trim()) return "Full name is required";
    if (!form.phone.trim()) return "Phone is required";
    if (!form.industry_id) return "Please select an industry";
    if (!form.aadhaar_image_base64) return "Please capture Aadhaar photo";
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email))
      return "Email is invalid";
    return null;
  };

  const onSave = async () => {
    const err = validate();
    if (err) {
      Alert.alert("Missing info", err);
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        industry_id: form.industry_id,
        aadhaar_image_url: form.aadhaar_image_base64,
      };
      if (form.email.trim()) payload.email = form.email.trim();
      if (form.address.trim()) payload.address = form.address.trim();
      if (form.dob.trim()) payload.dob = form.dob.trim();
      if (form.joining_date.trim())
        payload.joining_date = form.joining_date.trim();
      if (form.designation.trim()) payload.designation = form.designation.trim();
      if (form.salary.trim()) payload.salary = parseFloat(form.salary);

      await apiRequest("/employees", { method: "POST", body: payload });
      Alert.alert("Success", "Employee onboarded successfully", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

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
            placeholder="John Doe"
            testID="new-emp-name"
          />
          <Field
            label="PHONE *"
            value={form.phone}
            onChangeText={(t) => set("phone", t)}
            placeholder="+91 98xxxxxxxx"
            keyboardType="phone-pad"
            testID="new-emp-phone"
          />
          <Field
            label="EMAIL"
            value={form.email}
            onChangeText={(t) => set("email", t)}
            placeholder="name@example.com"
            keyboardType="email-address"
            testID="new-emp-email"
          />
          <Field
            label="ADDRESS"
            value={form.address}
            onChangeText={(t) => set("address", t)}
            placeholder="Street, City, State"
            multiline
            testID="new-emp-address"
          />
          <Field
            label="DATE OF BIRTH"
            value={form.dob}
            onChangeText={(t) => set("dob", t)}
            placeholder="YYYY-MM-DD"
            testID="new-emp-dob"
          />

          <Text style={[styles.section, { marginTop: spacing.lg }]}>
            Job Details
          </Text>
          <Field
            label="DESIGNATION"
            value={form.designation}
            onChangeText={(t) => set("designation", t)}
            placeholder="e.g. Warehouse Associate"
            testID="new-emp-designation"
          />
          <Field
            label="JOINING DATE"
            value={form.joining_date}
            onChangeText={(t) => set("joining_date", t)}
            placeholder="YYYY-MM-DD"
            testID="new-emp-joining"
          />
          <Field
            label="MONTHLY SALARY (₹)"
            value={form.salary}
            onChangeText={(t) => set("salary", t)}
            placeholder="0"
            keyboardType="numeric"
            testID="new-emp-salary"
          />

          <Text style={styles.label}>INDUSTRY *</Text>
          <TouchableOpacity
            testID="new-emp-industry-picker"
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
                resizeMode="cover"
              />
            ) : (
              <View style={styles.aadhaarEmpty}>
                <Ionicons
                  name="id-card-outline"
                  size={44}
                  color={colors.textMuted}
                />
                <Text style={styles.aadhaarHint}>
                  Capture or choose the Aadhaar card photo. Stored securely.
                </Text>
              </View>
            )}
            <View style={styles.aadhaarActions}>
              <TouchableOpacity
                testID="aadhaar-camera-btn"
                style={[styles.secondaryBtn, { flex: 1 }]}
                onPress={takePhoto}
              >
                <Ionicons name="camera" size={18} color={colors.primary} />
                <Text style={styles.secondaryText}>Take Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="aadhaar-gallery-btn"
                style={[styles.secondaryBtn, { flex: 1 }]}
                onPress={pickFromGallery}
              >
                <Ionicons name="images" size={18} color={colors.primary} />
                <Text style={styles.secondaryText}>From Gallery</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            testID="new-emp-save-btn"
            style={[styles.saveBtn, saving && { opacity: 0.7 }]}
            onPress={onSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveText}>Onboard Employee</Text>
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
                testID={`industry-option-${i.id}`}
                style={styles.option}
                onPress={() => {
                  set("industry_id", i.id);
                  setIndustryPickerOpen(false);
                }}
              >
                <Text style={styles.optionText}>{i.name}</Text>
                {form.industry_id === i.id && (
                  <Ionicons
                    name="checkmark"
                    size={20}
                    color={colors.primary}
                  />
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
  },
  aadhaarEmpty: {
    alignItems: "center",
    padding: 24,
    gap: 8,
  },
  aadhaarHint: {
    color: colors.textSecondary,
    fontSize: 12,
    textAlign: "center",
    marginHorizontal: 20,
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
