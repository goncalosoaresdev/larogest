import { requireSession } from "@/lib/session";
import { AppSidebar } from "@/components/app-sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar userName={session.user.name} />
      <main className="min-w-0 flex-1 p-6">{children}</main>
    </div>
  );
}
