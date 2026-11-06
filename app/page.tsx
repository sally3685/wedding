"use client";
import dynamic from "next/dynamic";

const EnvelopeOpening = dynamic(
  () => import("@/components/shared/navbar/EnvelopeReveal"),
  { ssr: false },
);

export default function Page() {
  return (
    <>
      <EnvelopeOpening onOpened={() => console.log("revealed")} />
      {/* your real page here */}
    </>
  );
}
