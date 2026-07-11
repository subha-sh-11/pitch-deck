import type { Metadata } from "next";
import {
  Anton,
  Cormorant_Garamond,
  Geist,
  Geist_Mono,
  Oswald,
  Playfair_Display,
  Poppins,
} from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

// Theme-driven display fonts (selected per style register).
const playfair = Playfair_Display({ variable: "--font-playfair", subsets: ["latin"] });
const oswald = Oswald({ variable: "--font-oswald", subsets: ["latin"] });
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});
const anton = Anton({ variable: "--font-anton", subsets: ["latin"], weight: ["400"] });

export const metadata: Metadata = {
  title: "Pitch Deck Studio — AI Pitch Deck for Filmmakers",
  description:
    "Turn film ideas, scripts, and director vision into cinematic investor-ready pitch decks.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${cormorant.variable} ${playfair.variable} ${oswald.variable} ${poppins.variable} ${anton.variable} h-full antialiased`}
    >
      {/* Browser extensions (password managers, Bitdefender, etc.) inject
          attributes like `bis_register` / `__processed_*` onto <body> before
          React hydrates, causing a benign attribute mismatch. Suppress it —
          this only silences the body's own attributes, one level deep. */}
      <body
        suppressHydrationWarning
        className="min-h-full flex flex-col bg-surface-0 text-text-primary font-sans"
      >
        {children}
      </body>
    </html>
  );
}
