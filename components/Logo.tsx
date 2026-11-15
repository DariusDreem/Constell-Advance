import { sparklePath } from "@/lib/constellation/shapes";

/** Logo mark: a small constellation whose brightest point is a four-pointed star. */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="shrink-0">
      <path
        d="M5 25L12 15L21.5 10M12 15L27 24"
        fill="none"
        stroke="#c4a5ff"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.7"
      />
      <circle cx="5" cy="25" r="1.7" fill="#fff" opacity="0.85" />
      <circle cx="12" cy="15" r="2" fill="#fff" />
      <circle cx="27" cy="24" r="1.5" fill="#fff" opacity="0.75" />
      <g transform="translate(21.5 10)">
        <circle r="8" fill="#c4a5ff" opacity="0.22" />
        <path d={sparklePath(8.5, 0.14)} fill="#fff" />
      </g>
    </svg>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <LogoMark />
      {!compact && (
        <span className="font-display truncate text-[clamp(11.5px,0.85vw,15px)] font-semibold tracking-[0.06em] text-white uppercase">
          Constellation
        </span>
      )}
    </span>
  );
}
