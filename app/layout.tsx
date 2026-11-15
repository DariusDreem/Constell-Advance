import type { Metadata } from "next";
import { Geist, Space_Grotesk } from "next/font/google";
import { Starfield } from "@/components/cosmos/Starfield";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const display = Space_Grotesk({
  variable: "--font-space",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Constellation",
  description: "Suis tes avancées comme une constellation : un domaine par branche, un palier par étoile.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${geistSans.variable} ${display.variable} h-full antialiased`}>
      <body className="h-full">
        <div aria-hidden className="cosmos">
          <Starfield />
        </div>
        {children}
      </body>
    </html>
  );
}
