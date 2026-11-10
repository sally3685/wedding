"use client";
import FinalSection from "@/components/shared/navbar/FinalSection";
import FirstSection from "@/components/shared/navbar/firstSection";
import FivthSection from "@/components/shared/navbar/fivthSection";
import FourthSection from "@/components/shared/navbar/fourthSection";
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
      <FirstSection active={opened} />
      <SecondSection />
      <ThirdSection />
      <FourthSection />
      <FivthSection />

      <FinalSection />
    </>
  );
}
