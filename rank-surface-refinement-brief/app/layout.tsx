import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Make the Action Feel Inevitable — StackRank Rank Surface Brief",
  description: "Three responsive Rank Bar, suggestion-lane, and pack-card design directions for StackRank.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: { title: "Make the Action Feel Inevitable", description: "StackRank Rank surface refinement brief", images: ["/og.png"] },
  twitter: { card: "summary_large_image", title: "Make the Action Feel Inevitable", description: "StackRank Rank surface refinement brief", images: ["/og.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${geist.variable} ${mono.variable}`}>{children}</body></html>;
}
