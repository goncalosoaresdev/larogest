import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Larogest",
  description: "Leads, propostas e contratos",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt" className="dark">
      <body>{children}</body>
    </html>
  );
}
