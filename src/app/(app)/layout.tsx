import { AppSidebar } from "@/components/app-sidebar";
import { StaffShell } from "@/components/staff-shell";
import { requireSession } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();

  return (
    <StaffShell>
      <div className="flex min-h-screen bg-background">
        <AppSidebar userName={session.user.name} />
        <main className="min-w-0 flex-1 p-6">{children}</main>
      </div>
    </StaffShell>
  );
}
