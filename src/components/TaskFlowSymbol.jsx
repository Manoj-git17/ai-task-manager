import { useId } from "react";

/**
 * TaskFlowSymbol
 * Official TaskFlow Brand Symbol & Orchestrator Flow Glyph
 * Provides the signature energetic TaskFlow symbol with crisp vector precision.
 */
export default function TaskFlowSymbol({
  size = 20,
  className = "",
  fill = "currentColor",
  glow = false,
  variant = "bolt", // 'bolt' | 'origami'
}) {
  const generatedId = useId();
  const gradId = `tf_sym_${generatedId.replace(/:/g, "")}`;
  const actualFill = fill === "gradient" ? `url(#${gradId})` : fill;

  if (variant === "origami") {
    return (
      <svg
        width={size}
        height={(size * 46) / 48}
        viewBox="0 0 48 46"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`tf-symbol-svg ${glow ? "has-glow" : ""} ${className}`}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#A78BFA" />
            <stop offset="50%" stopColor="#818CF8" />
            <stop offset="100%" stopColor="#6366F1" />
          </linearGradient>
        </defs>
        <path
          d="M25.946 44.938c-.664.845-2.021.375-2.021-.698V33.937a2.26 2.26 0 0 0-2.262-2.262H10.287c-.92 0-1.456-1.04-.92-1.788l7.48-10.471c1.07-1.497 0-3.578-1.842-3.578H1.237c-.92 0-1.456-1.04-.92-1.788L10.013.474c.214-.297.556-.474.92-.474h28.894c.92 0 1.456 1.04.92 1.788l-7.48 10.471c-1.07 1.498 0 3.579 1.842 3.579h11.377c.943 0 1.473 1.088.89 1.83L25.947 44.94z"
          fill={actualFill}
        />
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`tf-symbol-svg ${glow ? "has-glow" : ""} ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#A78BFA" />
          <stop offset="50%" stopColor="#818CF8" />
          <stop offset="100%" stopColor="#6366F1" />
        </linearGradient>
      </defs>
      <path
        d="M13 2L3 14H12L11 22L21 10H12L13 2Z"
        fill={actualFill}
        stroke={actualFill}
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
