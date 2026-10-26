import { useId } from "react";

/**
 * GeminiSparkle
 * Signature Google Gemini celestial 4-point sparkle brand mark
 * Supports signature multi-color iridescent gradient or monochrome solid fills.
 */
export default function GeminiSparkle({
  size = 22,
  className = "",
  fill = "url(#geminiBrandGrad)",
  single = false,
  glow = false,
}) {
  const generatedId = useId();
  const gradId = `tf_gem_${generatedId.replace(/:/g, "")}`;
  const actualFill = fill === "url(#geminiBrandGrad)" ? `url(#${gradId})` : fill;

  if (single) {
    return (
      <svg
        className={`tf-gemini-sparkle-svg ${glow ? "has-glow" : ""} ${className}`}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4285f4" />
            <stop offset="36%" stopColor="#9b51e0" />
            <stop offset="72%" stopColor="#ec4899" />
            <stop offset="100%" stopColor="#ff7700" />
          </linearGradient>
        </defs>
        <path
          d="M12 2C12 7.52285 7.52285 12 2 12C7.52285 12 12 16.4772 12 22C12 16.4772 16.4772 12 22 12C16.4772 12 12 7.52285 12 2Z"
          fill={actualFill}
        />
      </svg>
    );
  }

  return (
    <svg
      className={`tf-gemini-sparkle-svg ${glow ? "has-glow" : ""} ${className}`}
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4285f4" />
          <stop offset="36%" stopColor="#9b51e0" />
          <stop offset="72%" stopColor="#ec4899" />
          <stop offset="100%" stopColor="#ff7700" />
        </linearGradient>
      </defs>
      {/* Primary Gemini celestial star */}
      <path
        d="M12 4C12 9.52285 7.52285 14 2 14C7.52285 14 12 18.4772 12 24C12 18.4772 16.4772 14 22 14C16.4772 14 12 9.52285 12 4Z"
        fill={actualFill}
      />
      {/* Secondary companion celestial star */}
      <path
        d="M21 2C21 4.20914 19.2091 6 17 6C19.2091 6 21 7.79086 21 10C21 7.79086 22.7909 6 25 6C22.7909 6 21 4.20914 21 2Z"
        fill={actualFill}
        opacity={fill === "url(#geminiBrandGrad)" ? "0.92" : "0.85"}
      />
    </svg>
  );
}
