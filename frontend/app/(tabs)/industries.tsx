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
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiRequest, Industry } from "../../src/api";
import { useAuth } from "../../src/auth";
import { colors, radius, spacing } from "../../src/theme";

export default function IndustriesScreen() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{
    open: boolean;
    mode: "create" | "edit";
    id?: string;
    name: string;
    description: string;
  }>({ open: false, mode: "create", name: "", description: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await apiRequest<Industry[]>("/industries");
      setIndustries(list);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const openCreate = () =>
    setModal({ open: true, mode: "create", name: "", description: "" });

  const openEdit = (i: Industry) =>
    setModal({
      open: true,
      mode: "edit",
      id: i.id,
      name: i.name,
      description: i.description ?? "",
    });

  const close = () => setModal((m) => ({ ...m, open: false }));

  const save = async () => {
    if (!modal.name.trim()) {
      Alert.alert("Validation", "Industry name is required");
      return;
    }
    setSaving(true);
    try {
      if (modal.mode === "create") {
        await apiRequest<Industry>("/industries", {
          method: "POST",
          body: {
            name: modal.name.trim(),
            description: modal.description.trim() || null,
          },
        });
      } else {
        await apiRequest<Industry>(`/industries/${modal.id}`, {
          method: "PUT",
          body: {
            name: modal.name.trim(),
            description: modal.description.trim() || null,
          },
        });
      }
      close();
      await load();
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
  try {
    await apiRequest(`/industries/${id}`, { method: "DELETE" });
    await load();
  } catch (e: any) {
    if (Platform.OS === "web") {
      window.alert(e?.message ?? "Failed");
    } else {
      Alert.alert("Cannot delete", e?.message ?? "Failed");
    }
  }
};

  const onDelete = (i: Industry) => {
  if (Platform.OS === "web") {
    const confirmed = window.confirm(
      `Remove "${i.name}"?\n\nThis is blocked if employees are tagged.`
    );

    if (confirmed) {
      handleDelete(i.id);
    }
    return;
  }

  Alert.alert(
    "Delete Industry",
    `Remove "${i.name}"? This is blocked if employees are tagged to it.`,
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => handleDelete(i.id),
      },
    ]
  );
};



  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Industries</Text>
        {isAdmin ? (
          <TouchableOpacity
            testID="industries-add-btn"
            style={styles.addBtn}
            onPress={openCreate}
          >
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <ActivityIndicator
          color={colors.primary}
          style={{ marginTop: 40 }}
        />
      ) : (
        <FlatList
          data={industries}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons
                name="business-outline"
                size={40}
                color={colors.textMuted}
              />
              <Text style={styles.emptyTitle}>No industries</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.row} testID={`industry-row-${item.id}`}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                {item.description ? (
                  <Text style={styles.desc}>{item.description}</Text>
                ) : null}
              </View>
              {isAdmin ? (
                <>
                  <TouchableOpacity
                    testID={`industry-edit-${item.id}`}
                    onPress={() => openEdit(item)}
                    style={styles.iconBtn}
                  >
                    <Ionicons name="pencil" size={18} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    testID={`industry-delete-${item.id}`}
                    onPress={() => onDelete(item)}
                    style={styles.iconBtn}
                  >
                    <Ionicons name="trash" size={18} color={colors.danger} />
                  </TouchableOpacity>
                </>
              ) : null}
            </View>
          )}
        />
      )}

      <Modal
        visible={modal.open}
        transparent
        animationType="slide"
        onRequestClose={close}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalRoot}
        >
          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={1}
            onPress={close}
          />
          <View style={styles.sheet} testID="industry-modal">
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>
              {modal.mode === "create" ? "Add Industry" : "Edit Industry"}
            </Text>
            <Text style={styles.label}>NAME</Text>
            <TextInput
              testID="industry-name-input"
              style={styles.input}
              value={modal.name}
              onChangeText={(t) => setModal((m) => ({ ...m, name: t }))}
              placeholder="e.g. Logistics"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={[styles.label, { marginTop: 12 }]}>DESCRIPTION</Text>
            <TextInput
              testID="industry-desc-input"
              style={[styles.input, { height: 80 }]}
              value={modal.description}
              onChangeText={(t) =>
                setModal((m) => ({ ...m, description: t }))
              }
              placeholder="Optional"
              placeholderTextColor={colors.textMuted}
              multiline
            />
            <TouchableOpacity
              testID="industry-save-btn"
              onPress={save}
              style={[styles.saveBtn, saving && { opacity: 0.7 }]}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveText}>Save</Text>
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
  name: { fontSize: 15, fontWeight: "600", color: colors.textPrimary },
  desc: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.slate100,
  },
  empty: { padding: spacing.xl, alignItems: "center" },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
    marginTop: 10,
  },
  modalRoot: { flex: 1, justifyContent: "flex-end" },
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
  saveBtn: {
    marginTop: 20,
    backgroundColor: colors.primary,
    borderRadius: radius.button,
    paddingVertical: 14,
    alignItems: "center",
  },
  saveText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});

