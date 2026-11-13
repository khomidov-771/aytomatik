import type { Metadata } from "next";
import { PreferencesProvider } from "@/components/preferences-provider";
import "./globals.css";
import "./design-system.css";
import "./replio.css";

export const metadata: Metadata = { title: { default: "REPLIO", template: "%s — REPLIO" }, description: "Every comment starts a conversation. Instagram comment-to-DM automation." };
const themeScript = `(function(){try{var t=localStorage.getItem('ids-theme');if(t!=='light'&&t!=='dark'){t='dark'}document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t}catch(e){}})()`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="uz" suppressHydrationWarning>
    <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
    <body><PreferencesProvider>{children}</PreferencesProvider></body>
  </html>;
}

