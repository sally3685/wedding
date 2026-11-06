import "./css/globals.css";
// import { lang } from "next/root-params";
// import Navbar from "@/components/shared/navbar/Navbar";
// import { getDictionary } from "@/lib/i18n/get-dictionary";
// import { DirectionProvider } from "@/components/ui/direction";
// import localFont from "next/font/local";
// import { Metadata } from "next";
// import { NavBarDict } from "@/config/i18n/dictionaries/types/nav";
// import { WhatsApp } from "@/features/floatingWhatsApp";
// import ThemeInitScript from "@/components/shared/ThemeInitScript";
// import EnvelopeReveal from "@/components/shared/navbar/EnvelopeReveal";

// const ITFGHROOBARABIC = localFont({
//   src: [
//     {
//       path: "../../public/fonts/ITFGHROOBARABIC-LIGHT.otf",
//       weight: "300",
//       style: "normal",
//     },
//     {
//       path: "../../public/fonts/ITFGHROOBARABIC-REGULAR.otf",
//       weight: "400",
//       style: "normal",
//     },
//     {
//       path: "../../public/fonts/ITFGHROOBARABIC-MEDIUM.otf",
//       weight: "500",
//       style: "normal",
//     },
//     {
//       path: "../../public/fonts/ITFGHROOBARABIC-BOLD.otf",
//       weight: "700",
//       style: "normal",
//     },
//     {
//       path: "../../public/fonts/ITFGHROOBARABIC-EXTRABOLD.otf",
//       weight: "800",
//       style: "normal",
//     },
//   ],
//   display: "swap",
// });

export default async function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      suppressHydrationWarning //for the adding of js class
    >
      <body className="min-h-dvh flex flex-col ">
        <div className="pt-20 lg:pt-23 min-h-dvh flex flex-col bg-kadroBeige">
          {children}
          {/* <WhatsApp /> */}
          {/* <EnvelopeReveal /> */}
        </div>
      </body>
    </html>
  );
}
