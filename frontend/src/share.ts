import * as FileSystem from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Alert, Platform } from "react-native";
import { Employee } from "./api";

function esc(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildEmployeeHtml(e: Employee): string {
  const salary =
    e.salary != null
      ? `₹ ${e.salary.toLocaleString("en-IN")}`
      : "—";
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><style>
  body { font-family: -apple-system, Segoe UI, Roboto, Arial; color:#0F172A; padding:32px; }
  .brand { color:#1E3A8A; font-size:22px; font-weight:700; letter-spacing:-0.3px; }
  .sub { color:#475569; font-size:12px; margin-top:2px; }
  .divider { height:2px; background:#1E3A8A; margin:16px 0 20px; }
  h2 { font-size:14px; color:#475569; letter-spacing:1px; text-transform:uppercase; margin:24px 0 10px; }
  .row { display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid #E2E8F0; font-size:13px; }
  .row .label { color:#64748B; }
  .row .val { color:#0F172A; font-weight:600; text-align:right; max-width:60%; }
  .pill { display:inline-block; background:#1E3A8A; color:#fff; padding:4px 10px; border-radius:999px; font-size:11px; font-weight:700; }
  .aadhaar { border:1px solid #E2E8F0; border-radius:8px; padding:12px; text-align:center; }
  .aadhaar img { max-width:100%; max-height:320px; border-radius:6px; }
  .footer { margin-top:28px; font-size:10px; color:#94A3B8; text-align:center; border-top:1px solid #E2E8F0; padding-top:10px; }
</style></head><body>
  <div class="brand">AAN Services</div>
  <div class="sub">Employee Onboarding Record · aanservices.in</div>
  <div class="divider"></div>

  <h2>Employee</h2>
  <div class="row"><span class="label">Name</span><span class="val">${esc(e.name)}</span></div>
  <div class="row"><span class="label">Designation</span><span class="val">${esc(e.designation)}</span></div>
  <div class="row"><span class="label">Industry</span><span class="val"><span class="pill">${esc(e.industry_name)}</span></span></div>

  <h2>Contact</h2>
  <div class="row"><span class="label">Phone</span><span class="val">${esc(e.phone)}</span></div>
  <div class="row"><span class="label">Email</span><span class="val">${esc(e.email)}</span></div>
  <div class="row"><span class="label">Address</span><span class="val">${esc(e.address)}</span></div>

  <h2>Employment</h2>
  <div class="row"><span class="label">Date of Birth</span><span class="val">${esc(e.dob)}</span></div>
  <div class="row"><span class="label">Joining Date</span><span class="val">${esc(e.joining_date)}</span></div>
  <div class="row"><span class="label">Salary</span><span class="val">${esc(salary)}</span></div>

  <h2>Aadhaar Card</h2>
  <div class="aadhaar"><img src="${e.aadhaar_image_base64}" alt="Aadhaar"/></div>

  <div class="footer">Generated on ${new Date().toLocaleString("en-IN")} · This document is confidential and for verification purposes only.</div>
</body></html>`;
}

export async function shareEmployeePdf(e: Employee): Promise<void> {
  const html = buildEmployeeHtml(e);

  if (Platform.OS === "web") {
    // Web: open print dialog in a new window
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
      w.focus();
      setTimeout(() => w.print(), 500);
    } else {
      Alert.alert("Popup blocked", "Allow popups to generate the PDF.");
    }
    return;
  }

  const { uri } = await Print.printToFileAsync({ html });
  const safeName = e.name.replace(/[^a-z0-9]/gi, "_");
  const destName = `AAN_${safeName}_${Date.now()}.pdf`;
  let shareUri = uri;
  try {
    const dest = `${FileSystem.cacheDirectory ?? ""}${destName}`;
    await FileSystem.moveAsync({ from: uri, to: dest });
    shareUri = dest;
  } catch {
    // fall back to original uri if move fails
  }

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(shareUri, {
      mimeType: "application/pdf",
      dialogTitle: `Share ${e.name}'s onboarding record`,
      UTI: "com.adobe.pdf",
    });
  } else {
    Alert.alert("Saved", `PDF generated at: ${shareUri}`);
  }
}

export async function shareCsvFile(
  text: string,
  filename: string
): Promise<void> {
  if (Platform.OS === "web") {
    const blob = new Blob([text], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  const path = `${FileSystem.cacheDirectory ?? ""}${filename}`;
  await FileSystem.writeAsStringAsync(path, text, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(path, {
      mimeType: "text/csv",
      dialogTitle: "Share employees CSV",
      UTI: "public.comma-separated-values-text",
    });
  } else {
    Alert.alert("Saved", `CSV saved to: ${path}`);
  }
}
