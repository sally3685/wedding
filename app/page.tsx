"use client";
import FirstSection from "@/components/shared/navbar/firstSection";
import SecondSection from "@/components/shared/navbar/secondSection";
import ThirdSection from "@/components/shared/navbar/thirdSection";
import dynamic from "next/dynamic";
import { useState } from "react";

const EnvelopeOpening = dynamic(
  () => import("@/components/shared/navbar/EnvelopeReveal"),
  { ssr: false },
);

export default function Page() {
  const [opened, setOpened] = useState(false);
  return (
    <>
      <EnvelopeOpening onOpened={() => setOpened(true)} />
      {/* your real page here */}
      <FirstSection active={opened} />
      <SecondSection />
      <ThirdSection />
    </>
  );
}
