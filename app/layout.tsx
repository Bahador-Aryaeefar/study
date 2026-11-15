import type { Metadata } from "next";
import "./globals.css";
import "./study.css";
import { ProgressProvider } from "@/lib/progress";
import SiteNav from "@/components/SiteNav";

export const metadata: Metadata = {
  title: "AI Engineer Roadmap",
  description: "A detailed, checkable study roadmap to become a senior AI / agent engineer.",
};

const THEME_INIT = `try{var t=localStorage.getItem("ai-roadmap-theme");if(!t){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.setAttribute("data-theme",t)}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body>
        <ProgressProvider>
          <SiteNav />
          {children}
        </ProgressProvider>
      </body>
    </html>
  );
}
