import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import { Providers } from "@/components/Providers";
import { SiteNav } from "@/components/SiteNav";
import { AppMain } from "@/components/AppMain";
import "./globals.css";

// Display face for headings + body face for everything else. Both are variable
// fonts, so text-size settings (F7) rescale cleanly without synthetic weights.
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
});

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Alfa",
  description: "A fitness app that adapts to your body and your energy today.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#F6EDDC",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${bricolage.variable} ${figtree.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-cream font-sans text-ink">
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <Providers>
          {/* Primary nav on every page: sticky top bar on desktop, fixed
           * bottom bar on mobile. On mobile the bottom padding clears that
           * fixed bar at every text size (F7 scales it, so rem-based) plus the
           * phone home-indicator safe area; on desktop the nav is at the top,
           * so this is just breathing room below the last content. Chrome-
           * hidden routes (e.g. the landing page at /) get their own nav and skip that
           * padding. See SiteNav / AppMain / lib/chromeRoutes. */}
          <SiteNav />
          <AppMain>{children}</AppMain>
        </Providers>
      </body>
    </html>
  );
}
