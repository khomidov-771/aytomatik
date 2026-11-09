import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: { default: "IDS Automate", template: "%s — IDS Automate" }, description: "Instagram comment-to-DM avtomatlashtirish platformasi" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="uz"><body>{children}</body></html>; }
