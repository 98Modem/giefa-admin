type GiefaLogoMarkProps = {
  className?: string;
  animated?: boolean;
};

export function GiefaLogoMark({
  className = "",
  animated = false,
}: GiefaLogoMarkProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 1080 1080"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <filter id="giefaExactLogoLift" x="108" y="100" width="864" height="886">
          <feDropShadow
            dx="0"
            dy="28"
            stdDeviation="28"
            floodColor="#020617"
            floodOpacity="0.32"
          />
        </filter>
      </defs>

      <g
        className={animated ? "giefa-visible-logo-mark" : undefined}
        filter="url(#giefaExactLogoLift)"
      >
        <image
          href="/logo/auth-logo.png"
          x="120"
          y="112"
          width="840"
          height="840"
          preserveAspectRatio="xMidYMid meet"
        />
      </g>
    </svg>
  );
}
