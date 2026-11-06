export type Role = "superadmin" | "superordinat" | "subordinat";

export type SessionUser = {
  id: string;
  nama: string;
  email: string;
  role: Role;
};
