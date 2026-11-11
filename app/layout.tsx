import "./css/globals.css";
import localFont from "next/font/local";

const ITFGHROOBARABIC = localFont({
  src: [
    { path: "../public/fonts/ZYROSERIF.otf", weight: "400", style: "normal" },
  ],
  display: "swap",
  variable: "--font-zyroserif",
  fallback: ["serif"],
});
// const thmanyahsans = localFont({
//   src: [
//     {
//       path: "../public/fonts/thmanyahsans-Regular.otf",
//       weight: "400",
//       style: "normal",
//     },
//   ],
//   display: "swap",
//   variable: "--font-thmanyahsans",
//   fallback: ["serif"],
// });
export default async function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      suppressHydrationWarning
      className={`  ${ITFGHROOBARABIC.className}`}
      lang="ar"
      dir="rtl"
    >
      <body className="min-h-dvh flex flex-col overflow-x-hidden">
        {children}
      </body>
    </html>
  );
}
