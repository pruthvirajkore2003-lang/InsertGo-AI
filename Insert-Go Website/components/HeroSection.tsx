import type { ReactNode } from "react";
import Image from "next/image";
import { LinearMagicStar } from "./icons/LinearMagicStar";
import { Typewriter } from "./Typewriter";
import { HOTKEYS } from "@/lib/constants/hotkeys";

// Static hero copy renders on the server and arrives as `children`; the rise
// and the mockup parallax are CSS animations, so nothing here hydrates.
export function HeroSection({ children }: { children: ReactNode }) {
  return (
    <section
      className="relative flex flex-col items-center px-6 pt-[150px] pb-[60px] text-center"
    >
      {children}

      {/* HERO MOCKUP */}
      <div className="animate-hero-rise relative mt-[72px] w-full max-w-[920px]">
        <div className="glass-panel overflow-hidden">
          <div className="flex items-center gap-2 border-b border-line bg-muted/5 px-4 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-line" />
            <span className="h-2.5 w-2.5 rounded-full bg-line" />
            <span className="h-2.5 w-2.5 rounded-full bg-line" />
            <span className="ml-2.5 text-xs text-muted">
              quarterly-update.docx — Microsoft Word
            </span>
          </div>
          <div className="flex flex-col gap-3.5 px-10 pt-8 pb-[120px]">
            <span className="h-3 w-[42%] rounded-md bg-muted/30" />
            <span className="h-[9px] w-[92%] rounded-[5px] bg-muted/15" />
            <span className="h-[9px] w-[86%] rounded-[5px] bg-muted/15" />
            <span className="h-[9px] w-[94%] rounded-[5px] bg-muted/15" />
            <span className="h-[9px] w-[60%] rounded-[5px] bg-muted/15" />
            <span className="h-[9px] w-[88%] rounded-[5px] border border-brand bg-accent/55" />
            <span className="h-[9px] w-[74%] rounded-[5px] border border-brand bg-accent/55" />
          </div>
        </div>

        {/* floating InsertGo overlay */}
        <div className="hero-parallax absolute top-[44%] left-1/2 w-[min(560px,92%)] -translate-x-1/2">
          <div className="animate-float">
            <div className="glass-floating overflow-hidden text-left">
              <div className="flex items-center justify-between border-b border-dark-2 px-4 py-3">
                <span className="flex items-center gap-2">
                  <Image
                    src="/main-logo.png"
                    alt=""
                    width={20}
                    height={20}
                    className="block h-5 w-5 object-contain [filter:drop-shadow(0_0_4px_rgba(255,255,255,0.35))]"
                  />
                  <span className="text-[13px] font-semibold text-cream">
                    InsertGo
                  </span>
                </span>
                <span className="glass-chip rounded-[5px] px-2 py-[3px] text-[10px] font-medium text-muted">
                  {HOTKEYS.primary.label}
                </span>
              </div>
              <div className="flex items-center gap-2.5 p-4">
                <span className="flex text-accent-hover">
                  <LinearMagicStar size={16} />
                </span>
                <span className="min-h-[22px] text-[15px] text-on-accent">
                  <Typewriter />
                  <span className="ml-0.5 inline-block h-4 w-0.5 animate-blink bg-accent-hover align-[-2px]" />
                </span>
              </div>
              <div className="flex flex-wrap gap-2 px-4 pb-3.5">
                {["Rewrite politely", "Summarize", "Fix grammar", "Translate"].map(
                  (t) => (
                    <span
                      key={t}
                      className="glass-chip rounded-full px-[11px] py-[5px] text-xs text-on-accent transition-colors duration-200 hover:border-accent/50"
                    >
                      {t}
                    </span>
                  )
                )}
              </div>
              <div className="flex items-center justify-between border-t border-dark-2 px-4 py-2.5">
                <span className="text-[11px] text-muted">
                  Response inserts into Microsoft Word
                </span>
                <span className="text-[11px] font-medium text-accent-hover">
                  Enter ↵ to insert
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
