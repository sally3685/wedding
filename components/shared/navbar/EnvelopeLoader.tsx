// components/EnvelopeLoader.tsx
export default function EnvelopeLoader({
  paperColor = "#f3ece0",
  text = "الرجاء الانتظار قليلا",
  fading = false,
  onFaded,
  zIndex = 9999,
}: {
  paperColor?: string;
  text?: string;
  fading?: boolean;
  onFaded?: () => void;
  zIndex?: number;
}) {
  return (
    <div
      onTransitionEnd={onFaded}
      style={{
        position: "fixed",
        inset: 0,
        height: "100dvh",
        zIndex,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: paperColor,
        opacity: fading ? 0 : 1,
        transition: "opacity 0.5s ease",
        pointerEvents: fading ? "none" : "auto",
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 16,
          letterSpacing: "0.08em",
          color: "#7a6a55",
          animation: "envelopeLoaderPulse 1.6s ease-in-out infinite",
        }}
      >
        {text}
      </p>
      <style>{`
        @keyframes envelopeLoaderPulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
