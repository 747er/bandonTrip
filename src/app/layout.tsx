import type { Metadata, Viewport } from "next";
import { Libre_Caslon_Display, Libre_Caslon_Text, Schibsted_Grotesk } from "next/font/google";
import "./globals.css";

const caslonDisplay = Libre_Caslon_Display({
  variable: "--font-caslon-display",
  weight: "400",
  subsets: ["latin"],
});

const caslonText = Libre_Caslon_Text({
  variable: "--font-caslon-text",
  weight: ["400", "700"],
  style: ["normal", "italic"],
  subsets: ["latin"],
});

const grotesk = Schibsted_Grotesk({
  variable: "--font-grotesk",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000",
  ),
  title: { default: "BandonTrip", template: "%s | BandonTrip" },
  description: "One place for the whole golf trip: tee times, tables, rooms and the leaderboard.",
};

export const viewport: Viewport = {
  themeColor: "#e9e7e0",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${caslonDisplay.variable} ${caslonText.variable} ${grotesk.variable} antialiased`}
    >
      <body>{children}</body>
    </html>
  );
}
