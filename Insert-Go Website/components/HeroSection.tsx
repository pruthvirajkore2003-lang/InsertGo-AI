import type { ReactNode } from "react";
import { FloaterDemo } from "./demos/FloaterDemo";

// Static hero copy renders on the server and arrives as `children`; the mockup
// is the interactive FloaterDemo island — a four-step summon → choose →
// insert → payoff loop that hydrates after the LCP paint.
export function HeroSection({ children }: { children: ReactNode }) {
  return (
    <section className="relative flex flex-col items-center px-6 pt-[150px] pb-[60px] text-center">
      {children}

      <div className="animate-hero-rise relative mt-[72px] w-full max-w-[920px]">
        <FloaterDemo />
      </div>
    </section>
  );
}
