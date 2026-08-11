/* eslint-disable @next/next/no-img-element */

// The real Microsoft four-square mark, self-hosted in /public (same convention
// as public/app-icons — zero third-party requests). Used wherever the site
// says "Windows" as a brand: download CTAs, nav, footer, system requirements.
// LinearWindows stays for outline-icon contexts (feature tiles).
//
// The mark sits on a white tile: its blue (#0078d4) vanishes on the blue
// accent/terracotta CTAs otherwise. Same treatment as the marquee AppChips.
export function WindowsLogo({
  size = 18,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const glyph = Math.round(size * 0.68);
  return (
    <span
      className={`flex shrink-0 items-center justify-center bg-white shadow-[0_1px_2px_rgba(0,0,0,0.25)] ${className ?? ""}`}
      style={{ width: size, height: size, borderRadius: size * 0.26 }}
      aria-hidden="true"
    >
      <img
        src="/windows-logo.svg"
        alt=""
        width={glyph}
        height={glyph}
        className="block"
      />
    </span>
  );
}
