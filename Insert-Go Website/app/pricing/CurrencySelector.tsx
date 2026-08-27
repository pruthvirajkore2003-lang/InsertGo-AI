"use client";

import type { Currency } from "@/lib/currency";

/**
 * `[ ₹ INR | $ USD ]` pill toggle for the price column.
 *
 * Built on two real `<input type="radio">`s rather than buttons with ARIA:
 * roving focus, arrow-key movement inside the group, one tab stop, and the
 * announced "2 of 2" position all come free from the platform, and none of it
 * can drift out of sync with the visual state the way `aria-checked` on a
 * `<button>` does. The inputs are `sr-only` (focusable, off-screen) and the
 * `<label>`s are the pills — `peer-checked:` / `peer-focus-visible:` paint the
 * selected and focused states, so keyboard users see the same ring mouse users
 * never trigger.
 *
 * The note underneath is not decoration. The toggle changes what is DISPLAYED;
 * Dodo localizes the actual charge from the visitor's real billing country, so
 * someone outside India who picks ₹ to browse must not be left believing they
 * will be charged rupees. Saying so here, next to the control that causes it,
 * is the difference between a currency switcher and a misleading price.
 */
export function CurrencySelector({
  value,
  onChange,
}: {
  value: Currency;
  onChange: (next: Currency) => void;
}) {
  const options: { id: Currency; label: string; symbol: string }[] = [
    { id: "INR", label: "INR", symbol: "₹" },
    { id: "USD", label: "USD", symbol: "$" },
  ];

  return (
    <div className="flex flex-col items-center gap-2">
      <fieldset
        className="glass-chip m-0 flex items-center gap-1 rounded-full p-1 ring-1 ring-white/12"
        aria-describedby="currency-note"
      >
        <legend className="sr-only">Display currency</legend>
        {options.map((o) => (
          <div key={o.id} className="relative">
            <input
              type="radio"
              name="display-currency"
              id={`currency-${o.id}`}
              value={o.id}
              checked={value === o.id}
              onChange={() => onChange(o.id)}
              className="peer sr-only"
            />
            <label
              htmlFor={`currency-${o.id}`}
              className="flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-4 text-[13px] font-medium text-muted transition-colors duration-200 select-none hover:text-ink peer-checked:bg-accent-primary peer-checked:text-on-accent peer-checked:shadow-[0_4px_16px_-6px_rgba(47,107,255,0.7)] peer-focus-visible:ring-2 peer-focus-visible:ring-accent-primary/70 peer-focus-visible:ring-offset-1 peer-focus-visible:outline-none"
            >
              <span aria-hidden>{o.symbol}</span>
              {o.label}
            </label>
          </div>
        ))}
      </fieldset>
      <p id="currency-note" className="m-0 text-center text-[12px] text-muted">
        Display currency. Checkout charges in the currency of your billing
        country.
      </p>
    </div>
  );
}
