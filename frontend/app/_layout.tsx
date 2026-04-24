import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../src/auth";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="login" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="employee/new"
            options={{
              headerShown: true,
              title: "Onboard Employee",
              presentation: "modal",
            }}
          />
          <Stack.Screen
            name="employee/[id]"
            options={{ headerShown: true, title: "Employee Details" }}
          />
          <Stack.Screen
            name="employee/edit/[id]"
            options={{ headerShown: true, title: "Edit Employee" }}
          />
          <Stack.Screen
            name="users"
            options={{ headerShown: true, title: "Manage Users" }}
          />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
