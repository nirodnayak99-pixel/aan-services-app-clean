import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiRequest, UserOut } from "../src/api";
import { useAuth } from "../src/auth";
import { colors, radius, spacing } from "../src/theme";

type FormState = {
  email: string;
  name: string;
  password: string;
  role: "admin" | "manager";
};

const EMPTY: FormState = { email: "", name: "", password: "", role: "manager" };

export default function UsersScreen() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<UserOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await apiRequest<UserOut[]>("/users");
      setUsers(list);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const openCreate = () => {
    setForm(EMPTY);
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.email.trim() || !form.name.trim() || form.password.length < 6) {
      Alert.alert(
        "Validation",
        "Email, name, and a password of at least 6 characters are required."
      );
      return;
    }
    setSaving(true);
    try {
      await apiRequest<UserOut>("/users", {
        method: "POST",
        body: {
          email: form.email.trim(),
          name: form.name.trim(),
          password: form.password,
          role: form.role,
        },
      });
      setModalOpen(false);
      await load();
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to create user");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = (u: UserOut) => {
    if (u.id === me?.id) {
      Alert.alert("Not allowed", "You cannot delete your own account.");
      return;
    }
    Alert.alert("Delete User", `Remove ${u.name} (${u.email})?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await apiRequest(`/users/${u.id}`, { method: "DELETE" });
            await load();
          } catch (e: any) {
            Alert.alert("Error", e?.message ?? "Failed");
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Manage Users</Text>
        <TouchableOpacity
          testID="users-add-btn"
          style={styles.addBtn}
          onPress={openCreate}
        >
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(u) => u.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const isSelf = item.id === me?.id;
            return (
              <View style={styles.row} testID={`user-row-${item.id}`}>
                <View
                  style={[
                    styles.avatar,
                    item.role === "admin" && { backgroundColor: colors.primary },
                  ]}
                >
                  <Text
                    style={[
                      styles.avatarText,
                      item.role === "admin" && { color: "#fff" },
                    ]}
                  >
                    {item.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.name}>
                    {item.name}
                    {isSelf ? "  (you)" : ""}
                  </Text>
                  <Text style={styles.meta}>{item.email}</Text>
                </View>
                <View
                  style={[
                    styles.rolePill,
                    item.role === "admin" && {
                      backgroundColor: colors.primary,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.roleText,
                      item.role === "admin" && { color: "#fff" },
                    ]}
                  >
                    {item.role.toUpperCase()}
                  </Text>
                </View>
                {!isSelf ? (
                  <TouchableOpacity
                    testID={`user-delete-${item.id}`}
                    onPress={() => onDelete(item)}
                    style={styles.iconBtn}
                  >
                    <Ionicons name="trash" size={18} color={colors.danger} />
                  </TouchableOpacity>
                ) : null}
              </View>
            );
          }}
        />
      )}

      <Modal
        visible={modalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setModalOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1, justifyContent: "flex-end" }}
        >
          <Pressable
            style={styles.backdrop}
            onPress={() => setModalOpen(false)}
          />
          <View style={styles.sheet} testID="user-create-modal">
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Add User</Text>

            <Text style={styles.label}>NAME</Text>
            <TextInput
              testID="user-name-input"
              style={styles.input}
              value={form.name}
              onChangeText={(t) => setForm((f) => ({ ...f, name: t }))}
              placeholder="Full name"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={[styles.label, { marginTop: 12 }]}>EMAIL</Text>
            <TextInput
              testID="user-email-input"
              style={styles.input}
              value={form.email}
              onChangeText={(t) => setForm((f) => ({ ...f, email: t }))}
              placeholder="email@aanservices.in"
              autoCapitalize="none"
              keyboardType="email-address"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={[styles.label, { marginTop: 12 }]}>PASSWORD</Text>
            <TextInput
              testID="user-password-input"
              style={styles.input}
              value={form.password}
              onChangeText={(t) => setForm((f) => ({ ...f, password: t }))}
              placeholder="Min 6 characters"
              secureTextEntry
              placeholderTextColor={colors.textMuted}
            />

            <Text style={[styles.label, { marginTop: 16 }]}>ROLE</Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              {(["manager", "admin"] as const).map((r) => {
                const active = form.role === r;
                return (
                  <TouchableOpacity
                    key={r}
                    testID={`user-role-${r}`}
                    style={[styles.roleBtn, active && styles.roleBtnActive]}
                    onPress={() => setForm((f) => ({ ...f, role: r }))}
                  >
                    <Text
                      style={[
                        styles.roleBtnText,
                        active && { color: "#fff" },
                      ]}
                    >
                      {r === "manager" ? "Manager" : "Super Admin"}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.roleHint}>
              {form.role === "admin"
                ? "Super Admins can manage users, industries, and delete employees."
                : "Managers can onboard and update employees; cannot manage industries or other users."}
            </Text>

            <TouchableOpacity
              testID="user-save-btn"
              onPress={save}
              style={[styles.saveBtn, saving && { opacity: 0.7 }]}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveText}>Create User</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  list: { paddingHorizontal: 20, paddingBottom: 40, gap: 10 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: 6,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.slate100,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.primary, fontWeight: "700", fontSize: 16 },
  name: { fontSize: 15, fontWeight: "600", color: colors.textPrimary },
  meta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  rolePill: {
    backgroundColor: colors.slate100,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  roleText: {
    fontSize: 10,
    color: colors.slate600,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.slate100,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  sheet: {
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
    marginBottom: 14,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    color: colors.slate500,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.slate50,
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.input,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.textPrimary,
  },
  roleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    backgroundColor: colors.surface,
  },
  roleBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  roleBtnText: { color: colors.textPrimary, fontWeight: "600", fontSize: 14 },
  roleHint: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 16,
  },
  saveBtn: {
    marginTop: 20,
    backgroundColor: colors.primary,
    borderRadius: radius.button,
    paddingVertical: 14,
    alignItems: "center",
  },
  saveText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
