import { StaffShell } from "@/components/staff-shell";

export default function PublicContractLayout({ children }: { children: React.ReactNode }) {
  return <StaffShell>{children}</StaffShell>;
}
