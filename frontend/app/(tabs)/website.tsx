import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { colors } from "../../src/theme";

const WEBSITE_URL = "https://aanservices.in";

export default function WebsiteScreen() {
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState(0);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title} testID="website-title">
            aanservices.in
          </Text>
          <Text style={styles.subtitle}>Company Website</Text>
        </View>
        <TouchableOpacity
          testID="website-reload-btn"
          style={styles.iconBtn}
          onPress={() => {
            setLoading(true);
            setKey((k) => k + 1);
          }}
        >
          <Ionicons name="refresh" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.webWrap} testID="website-webview">
        {Platform.OS === "web" ? (
          <iframe
            key={key}
            src={WEBSITE_URL}
            style={{ width: "100%", height: "100%", border: "none" }}
            onLoad={() => setLoading(false)}
          />
        ) : (
          <WebView
            key={key}
            source={{ uri: WEBSITE_URL }}
            onLoadEnd={() => setLoading(false)}
            startInLoadingState
          />
        )}
        {loading && (
          <View style={styles.loader} pointerEvents="none">
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loaderText}>Loading website…</Text>
          </View>
        )}
      </View>
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
    paddingVertical: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 18, fontWeight: "700", color: colors.textPrimary },
  subtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.slate100,
  },
  webWrap: { flex: 1, backgroundColor: "#fff" },
  loader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.85)",
    gap: 10,
  },
  loaderText: { color: colors.textSecondary, fontSize: 13 },
});
