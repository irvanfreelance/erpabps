export type Role = "admin" | "supervisor" | "data_analyst" | "tim_blast" | "read_only";

export type SessionUser = {
  id: string;
  nama: string;
  email: string;
  role: Role;
};
