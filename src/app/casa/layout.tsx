import type { Metadata, Viewport } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import "./casa.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-casa",
});

const serif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-casa-serif",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f7f4ed",
};

export const metadata: Metadata = {
  title: "Laro Pulse",
  description: "Estado da casa, em tempo real, com a Laro.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/casa-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/casa-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: { url: "/casa-icon-180.png", sizes: "180x180" },
  },
  appleWebApp: {
    capable: true,
    title: "Laro Pulse",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
};

export default function CasaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`laro-casa ${inter.variable} ${serif.variable} ${inter.className}`}>{children}</div>
  );
}
