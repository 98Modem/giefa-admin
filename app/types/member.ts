import { Role } from "@/app/employee_type/roles";

export type MemberStatus = "pending" | "approved" | "suspended" | "denied";

export type MemberRow = {
  id: string;
  first_name: string;
  status: MemberStatus;
  role: Role;
};
