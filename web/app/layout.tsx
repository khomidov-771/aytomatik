import type { Metadata } from "next";
import { PreferencesProvider } from "@/components/preferences-provider";
import "./globals.css";
import "./design-system.css";
import "./repleo.css";

export const metadata: Metadata = { title: { default: "REPLEO", template: "%s — REPLEO" }, description: "Instagram comment-to-Direct automation, built around clear rules and real Meta events." };
const themeScript = `(function(){try{var t=localStorage.getItem('ids-theme');if(t!=='light'&&t!=='dark'){t='dark'}document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t}catch(e){}})()`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="uz" suppressHydrationWarning>
    <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
    <body><PreferencesProvider>{children}</PreferencesProvider></body>
  </html>;
}
