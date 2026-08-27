/**
 * `[ ₹ INR | $ USD ]` toggle for the price column, shared by the plan panel
 * and the contextual upgrade modal.
 *
 * The desktop has no CDN geolocation header, so `detectCurrency()` guesses
 * from timezone and UI language — a VPN, a corporate UTC clock or a travelling
 * laptop can all make that guess wrong, and this is the fix the user reaches
 * for when it is. The choice lives in `monetizationStore` (persisted to
 * localStorage), so switching here moves every other pricing surface too.
 *
 * Two `aria-pressed` toggle buttons rather than a radiogroup: with a group
 * that small, `aria-pressed` gets the state announced correctly without owing
 * the roving-tabindex and arrow-key behaviour a radiogroup promises. Styling
 * is the existing `ig-chip` chip row — no new CSS.
 */
import type { Currency } from "@/services/billing";
import { useMonetizationStore } from "@/store/monetizationStore";

const OPTIONS: { id: Currency; label: string; symbol: string }[] = [
  { id: "INR", label: "INR", symbol: "₹" },
  { id: "USD", label: "USD", symbol: "$" },
];

export function CurrencyToggle() {
  const currency = useMonetizationStore((s) => s.currency);
  const setCurrency = useMonetizationStore((s) => s.setCurrency);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "0.35rem",
      }}
    >
      <div className="ig-chips" role="group" aria-label="Display currency">
        {OPTIONS.map((o) => (
          <button
            key={o.id}
            type="button"
            aria-pressed={currency === o.id}
            className={
              "ig-chip ig-chip--btn" +
              (currency === o.id ? " ig-chip--active" : "")
            }
            onClick={() => setCurrency(o.id)}
          >
            <span aria-hidden="true">{o.symbol}</span> {o.label}
          </button>
        ))}
      </div>
      {/* Not decoration: Dodo localises the real charge from the billing
          country on file, so a shopper browsing in ₹ who is billed in $ must
          not be left believing rupees is what leaves their account. */}
      <p className="ig-muted" style={{ margin: 0, fontSize: "0.78rem" }}>
        Display currency. Checkout charges in the currency of your billing
        country.
      </p>
    </div>
  );
}
