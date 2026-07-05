import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import { Providers } from "@/components/Providers";
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
  title: "Adaptive Fitness",
  description:
    "A fitness app that adapts to your body and your energy today.",
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
          <main id="main-content" className="flex flex-1 flex-col">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
