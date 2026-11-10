import "./css/globals.css";
// import { lang } from "next/root-params";
// import Navbar from "@/components/shared/navbar/Navbar";
// import { getDictionary } from "@/lib/i18n/get-dictionary";
// import { DirectionProvider } from "@/components/ui/direction";
import localFont from "next/font/local";
// import { Metadata } from "next";
// import { NavBarDict } from "@/config/i18n/dictionaries/types/nav";
// import { WhatsApp } from "@/features/floatingWhatsApp";
// import ThemeInitScript from "@/components/shared/ThemeInitScript";
// import EnvelopeReveal from "@/components/shared/navbar/EnvelopeReveal";

const ITFGHROOBARABIC = localFont({
  src: [
    { path: "../public/fonts/ZYROSERIF.otf", weight: "400", style: "normal" },
  ],
  display: "swap",
  variable: "--font-zyroserif",
  fallback: ["serif"],
});

export default async function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      suppressHydrationWarning
      className={ITFGHROOBARABIC.className}
      lang="ar" // ← add lang if it's Arabic
      dir="rtl" // ← if Arabic
    >
      <body className="min-h-dvh flex flex-col overflow-x-hidden">
        {children}
      </body>
    </html>
  );
}
