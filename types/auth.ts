export type Role = "superadmin" | "superordinat" | "subordinat";

export type SessionUser = {
  id: string;
  nama: string;
  email: string;
  role: Role;
  employeeId: string | null;
  /** Terisi jika sesi saat ini adalah hasil impersonate oleh superadmin */
  impersonatedBy?: {
    id: string;
    nama: string;
    email: string;
  } | null;
};
