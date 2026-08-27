import { LinearAdd } from "@/components/icons/LinearAdd";
import { faqs } from "./faqs";

/**
 * Native `<details>`, not a JS accordion.
 *
 * app/faq/layout.tsx publishes a FAQPage schema declaring all eleven answers.
 * The previous implementation mounted only the open panel (`{isOpen && …}`),
 * so ten of those answers never reached the server HTML: structured data
 * claiming content the page did not contain. Google's structured-data policy
 * requires the marked-up content to be present and visible, and an answer
 * engine crawling without JS could extract exactly one answer out of eleven —
 * on the page whose entire job is being extractable.
 *
 * `<details>` keeps every answer in the DOM unconditionally, collapsed by the
 * browser. It is also keyboard-operable, findable by in-page search and open
 * when printed, none of which the JS version got for free. Same pattern the
 * FAQ on app/cancel/page.tsx already uses.
 *
 * `<summary>` is one of the few elements whose content model explicitly admits
 * heading content, so the h2 stays: the page's only h1 is the hero, and a
 * plain button here would drop these eleven questions out of the outline.
 */
export function FaqAccordion() {
  return (
    <div className="flex flex-col gap-3">
      {faqs.map(([q, a], i) => (
        <details
          key={q}
          // The first one open on load, as the JS version did.
          open={i === 0}
          className="glass-card group overflow-hidden transition-colors duration-300 open:border-brand"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-[22px] py-5 text-left transition-colors duration-200 hover:bg-muted/5 [&::-webkit-details-marker]:hidden">
            <h2 className="m-0 text-base font-medium text-ink">{q}</h2>
            <span
              aria-hidden
              className="flex shrink-0 text-brand transition-transform duration-300 group-open:rotate-45"
            >
              <LinearAdd size={18} />
            </span>
          </summary>
          <p className="m-0 px-[22px] pb-5 text-[15px] leading-[1.7] text-muted">
            {a}
          </p>
        </details>
      ))}
    </div>
  );
}
