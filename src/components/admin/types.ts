import type { BranchAssignment, UserRole } from "../../types";

export interface UserFormState {
  id?: string;
  name: string;
  username: string;
  role: UserRole;
  email: string;
  branchId?: string;
  branchName?: string;
  department?: string;
  password?: string;
}

export interface BranchFormState {
  id?: string;
  name: string;
  location: string;
  status: "Active" | "Inactive";
  userCount: number;
}

export type DeleteTarget =
  | { type: "user"; id: string; name: string }
  | { type: "branch"; id: string; name: string };

export const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "BRANCH_USER", label: "Branch User" },
  { value: "IT_STAFF", label: "IT Specialist" },
  { value: "ADMINISTRATOR", label: "Administrator" },
  { value: "AUDITOR", label: "Auditor (View-Only)" },
];

export const DURATION_OPTIONS = [1, 2, 3, 4, 5, 6, 9, 12];

export function buildAssignment(
  branchId: string,
  branchName: string,
  durationMonths: number,
): BranchAssignment {
  const assignedAt = new Date();
  const expiresAt = new Date(
    assignedAt.getTime() + durationMonths * 30 * 24 * 60 * 60 * 1000,
  );
  return {
    branchId,
    branchName,
    durationMonths,
    assignedAt: assignedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}
