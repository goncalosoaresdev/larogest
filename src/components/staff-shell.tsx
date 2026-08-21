import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import "@/app/globals.css";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export function StaffShell({ children }: { children: React.ReactNode }) {
  return (
    <div className={cn(geist.variable, geistMono.variable, "dark min-h-full font-sans antialiased")}>
      {children}
      <Toaster theme="dark" />
    </div>
  );
}
