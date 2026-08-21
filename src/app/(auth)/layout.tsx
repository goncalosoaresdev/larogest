import { StaffShell } from "@/components/staff-shell";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <StaffShell>{children}</StaffShell>;
}
