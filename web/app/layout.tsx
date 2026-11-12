import type { Metadata } from "next";
import { PreferencesProvider } from "@/components/preferences-provider";
import "./globals.css";
import "./design-refresh.css";

export const metadata: Metadata = { title: { default: "IDS Automate", template: "%s — IDS Automate" }, description: "Instagram comment-to-DM avtomatlashtirish platformasi" };
const themeScript = `(function(){try{var t=localStorage.getItem('ids-theme');if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t}catch(e){}})()`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="uz" suppressHydrationWarning>
    <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
    <body><PreferencesProvider>{children}</PreferencesProvider></body>
  </html>;
}
