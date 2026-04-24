import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const BACKEND_URL = "https://aan-backend-production.up.railway.app";

export const TOKEN_KEY = "aan_auth_token";

export async function getToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    return localStorage.getItem(TOKEN_KEY);
  }
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.setItem(TOKEN_KEY, token);
    return;
  }
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.removeItem(TOKEN_KEY);   // 🔴 THIS FIXES WEB LOGOUT
    return;
  }
  await AsyncStorage.removeItem(TOKEN_KEY);
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: any;
  auth?: boolean;
};

export async function apiRequest<T = any>(
  path: string,
  { method = "GET", body, auth = true }: RequestOptions = {}
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (auth) {
    const token = await getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${BACKEND_URL}/${path.replace(/^\/+/, "")}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Invalid server response: ${text}`);
  }
  if (!res.ok) {
    const detail = data?.detail;
    const msg =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
        ? detail.map((d: any) => d?.msg || JSON.stringify(d)).join(", ")
        : `Request failed (${res.status})`;
    const err = new Error(msg) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return data as T;
}

export type User = { id: string; email: string; name: string; role: string };
export type UserOut = User & { created_at: string };
export type Industry = {
  id: string;
  name: string;
  description?: string | null;
  created_at: string;
};
export type EmployeeListItem = {
  id: string;
  name: string;
  phone: string;
  designation?: string | null;
  industry_id: string;
  industry_name: string;
  created_at: string;
};
export type Employee = EmployeeListItem & {
  email?: string | null;
  address?: string | null;
  dob?: string | null;
  joining_date?: string | null;
  salary?: number | null;
  aadhaar_image_base64: string;
};
export type Stats = {
  total_employees: number;
  total_industries: number;
  recent_employees: EmployeeListItem[];
};

export async function downloadCsv(
  industryId?: string | null
): Promise<{ text: string; filename: string }> {
  const token = await getToken();
  const qs = industryId ? `?industry_id=${encodeURIComponent(industryId)}` : "";
  const res = await fetch(`${BACKEND_URL}/employees/export.csv${qs}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`Export failed (${res.status})`);
  const disposition = res.headers.get("content-disposition") ?? "";
  const match = disposition.match(/filename="?([^";]+)"?/i);
  const filename = match?.[1] ?? `aan_employees_${Date.now()}.csv`;
  const text = await res.text();
  return { text, filename };
}
