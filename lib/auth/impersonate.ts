import { createHmac } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "abps_impersonate";
const SECRET = process.env.NEXTAUTH_SECRET || "abps-secret-impersonate-fallback-key";

/**
 * Tanda tangani impersonation payload (id karyawan yang sedang di-impersonate).
 * Format: employeeId.timestamp.signature
 */
export function signImpersonation(employeeId: string): string {
  const ts = Date.now().toString();
  const data = `${employeeId}.${ts}`;
  const sig = createHmac("sha256", SECRET).update(data).digest("hex");
  return `${data}.${sig}`;
}

/**
 * Verifikasi cookie impersonation dan return employeeId bila valid.
 */
export function verifyImpersonation(cookieVal: string | undefined | null): string | null {
  if (!cookieVal) return null;
  const parts = cookieVal.split(".");
  if (parts.length !== 3) return null;
  const [empId, ts, sig] = parts;
  const expectedSig = createHmac("sha256", SECRET).update(`${empId}.${ts}`).digest("hex");
  if (sig !== expectedSig) return null;

  // Berlaku 7 hari
  const age = Date.now() - Number(ts);
  if (isNaN(age) || age < 0 || age > 7 * 24 * 60 * 60 * 1000) {
    return null;
  }
  return empId;
}

export async function getImpersonatedEmployeeId(): Promise<string | null> {
  const cookieStore = await cookies();
  const c = cookieStore.get(COOKIE_NAME);
  return verifyImpersonation(c?.value);
}

export { COOKIE_NAME };

