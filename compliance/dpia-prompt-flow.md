# DPIA — cross-border prompt flow

**Remediation item:** R-22. **Depends on:** R-21 (RoPA — `compliance/ropa.json`).
**Legal basis:** DPDP Act 2023 §10(2) (mandatory for a Significant Data
Fiduciary, recommended otherwise); §16 (cross-border transfer).
**Status:** Draft — unsigned. See §8.
**Date:** 2026-08-08. **Review trigger:** any new model provider on the managed
relay, any change to what leaves the device, or notification as an SDF (R-20).

---

## 1. Why this exists when it is not required

InsertGo is not a Significant Data Fiduciary, so §10(2) does not compel a DPIA.
This one covers a single flow anyway: **user prompt text leaving India for
Google's Gemini API on the managed relay**. That is the whole of it — see
Correction 2: the second flow this page was drafted around never existed and is
now cancelled.

That flow is worth the page because it is simultaneously the highest-sensitivity
data the product touches (drafts, emails, private writing), the least controlled
path, and the first thing a regulator would ask about.

The value is in establishing intent **before** being asked. A DPIA produced
after an inquiry is a defence; one produced beforehand is a control.

---

> ## ⚠️ Correction 2, 2026-08-08 — BYOK is cancelled, not merely absent
>
> Later the same day, the product decision was taken: **InsertGo will not
> implement BYOK, now or in any future release.** The first correction below
> found the feature missing and left open whether it was unshipped or
> abandoned. It is abandoned. Consequences for this page:
>
> - **§2's comparison table is history**, not a description of intended
>   architecture. It is kept because the reasoning in it — why user-initiated
>   egress is not a subprocessor relationship — is what a future reviewer needs
>   if the question is ever reopened. Nothing in it describes InsertGo.
> - **Risk 6 is struck**, not "open": a user cannot misunderstand a mode that
>   cannot be configured.
> - **The proportionality argument is weaker than the first draft claimed.**
>   "A user who wants us out of the path can take us out of it" was the
>   strongest line in §3 and it is now false. What remains is declining the AI
>   features or not using the product. Residual risk on the one flow that does
>   exist is correspondingly higher.
> - **The capability scopes now enforce the single flow.** The ~35 provider
>   hosts in `capabilities/default.json` and the `https://**` scope on
>   `selfloater.json` were deleted with the feature, so the desktop can reach
>   `insertgo.ai` and nothing else. That is a stronger safeguard than any
>   sentence on this page, and it is new since the first correction.
>
> ---
>
> ## ⚠️ Correction 1, 2026-08-08 — BYOK is not in the shipped build
>
> This assessment was scoped on the premise that BYOK is a live lane. **It is
> not.** Verified in the desktop tree:
> `aiProviders.ts:496` — `createProvider()` **throws** for any base URL whose
> host is not `generativelanguage.googleapis.com`; `types/index.ts:20-26` —
> `ProviderConfig.apiKey` is `@deprecated`, "always empty or a dummy marker";
> `src-tauri/src/domain/providers.rs:3-8` — "no secret is stored here… any
> legacy `apiKey` field … is ignored"; and even the Gemini lane posts to
> **our own relay**, not to Google (`aiProviders.ts:75-79`).
>
> **Every user is on the managed relay, always.** §2 below is therefore the
> *intended* architecture, not the current one, and §6 risk 6 does not exist
> today. The live risk is the opposite one and it is not in the table below:
> the published privacy policy tells users a privacy-protective mode exists
> when it does not. That is R-15, and it is a misstatement in a legal document
> rather than a DPIA finding — recorded here so this page is not read as
> confirming BYOK ships. *(Closed by the decision above: both policies were
> corrected in legal version 1.3.0.)*
>
> Everything else in this assessment stands: the managed-relay flow is real and
> is what it describes.

## 2. The two flows are not the same, and conflating them is the main risk

> **Historical (see Correction 2).** BYOK was cancelled on 2026-08-08 and the
> right-hand column describes nothing InsertGo does. Kept for the reasoning
> below the table, which is what a reviewer needs if user-initiated egress is
> ever proposed again.

| | **Managed relay** | **BYOK** *(cancelled — never shipped)* |
|---|---|---|
| Who sends the text | InsertGo's server (`/api/ai/generate`) | The user's own machine |
| Who is the recipient | Google, as **our** processor | The provider the **user** chose |
| Whose terms govern | Ours + our processor terms (R-18) | That provider's, with the user |
| Is InsertGo a recipient? | Yes | **No — we never see it** |
| Our API key or theirs | Ours | Theirs, in Windows Credential Manager |

**On BYOK, InsertGo is not a party to the transfer.** It is user-initiated
egress, which is why it is deliberately excluded from the subprocessor register
(`subprocessors.md` §3.2) and why the correct control is a notice at the point
of choice (R-15), not a processor contract we have no standing to sign.

Stating this distinction is itself a control: the failure mode is a future
reviewer reading "35 providers" as 35 subprocessors, and either building
contracts nobody can sign or concluding the posture is worse than it is.

---

## 3. Data categories

From `compliance/ropa.json` plus what transits without being stored:

| Item | Stored? | Sensitivity |
|---|---|---|
| Prompt text (the user's draft) | **No** — transits only | **Highest.** Free text: may contain anything the user is writing, including third parties' personal data |
| Generated response | Cached ≤24h in Upstash Vector, namespaced per (model, system, **user**) | High — a stored response restates the draft it came from |
| Prompt embedding | Same cache | High — a vector of the draft, not the draft, but derived from it |
| Token counts | Yes (`apiUsage`) | Low — counts, not content |
| Account id | Yes | Pseudonymous |

**Third-party data is the uncomfortable one.** A user improving an email
necessarily pastes text about other people who never consented to anything. That
is inherent to the product category and is handled by minimisation and
non-retention rather than by consent — there is no consent to obtain from a
person we cannot identify and never store.

---

## 4. Necessity and proportionality

- **Necessity:** the product is a writing assistant. Sending the text to a model
  is the service, not an ancillary use of it.
- **Minimisation:** the relay logs token counts only, never content
  (`app/api/ai/generate/route.ts`; SPEC §10). This is enforced by the R-06 CI
  gate, not by convention.
- **Alternative considered and rejected:** BYOK, which would have removed
  InsertGo from the flow entirely. This page originally recorded it as
  *provided*, and called it the strongest answer to "was this proportionate?" —
  a stronger answer than any amount of policy text. It was never built and was
  cancelled outright on 2026-08-08. **The proportionality case is weaker
  without it**, and saying so is the point of the section: the honest position
  is that a user who does not want us in the path has no supported way to take
  us out of it short of not using the AI features.
- **Alternative rejected:** on-device inference for the managed tier. Real
  privacy gain, and not deliverable at the quality this product sells at on the
  hardware it targets. Recorded so it reads as a decision rather than an
  omission. *(Local Whisper dictation already runs on-device, so the boundary is
  drawn per-capability, not ideologically.)*

---

## 5. Cross-border position

§16 uses a **negative list**: a transfer is permitted unless the Central
Government restricts the destination by notification. No notification affects
Google's or any listed provider's jurisdiction as at the check recorded in
`subprocessors.md` §7.

Deliberately **not** produced: SCCs, adequacy assessments, transfer impact
assessments. Those are GDPR instruments and answer no Indian obligation.

Two live caveats:

1. CERT-In Direction 4's in-jurisdiction **logging** duty is independent of
   §16's permissiveness, and is currently **breached** — the audit log is in
   Tokyo (`subprocessors.md` §1). It does not affect this flow's lawfulness, and
   it is listed here so the two are never conflated.
2. §16 is monitorable, not settled. A restriction notification takes effect on
   its own terms; the monthly check in `subprocessors.md` §7 is the control.

---

## 6. Risks and treatment

| # | Risk | Likelihood | Impact | Treatment | Residual |
|---|---|---|---|---|---|
| 1 | Prompt text logged by us | Low | High | SPEC §10 rule + `lib/safeLog.ts` + R-06 CI gate that fails on the *shape* of a leak | **Low** |
| 2 | Cached response served to the wrong user | Very low | High | Cache namespace includes the user id, not just (model, system) — a stored response can never cross accounts | **Very low** |
| 3 | Prompt text retained by Google beyond the call | Low | Medium | Gemini API terms; R-18 processor contract **not yet signed** | **Medium — open** |
| 4 | Upstash holds prompt-derived content in an unknown region | Medium | Medium | Register row exists; **region unverified** (`subprocessors.md` §3, open action b) | **Medium — open** |
| 5 | User sends third-party personal data | **Certain** | Medium | Non-retention; token-count-only logging; disclosed in the §5 notice | Low |
| 6 | ~~BYOK user misunderstands where their text goes~~ | — | — | **Struck 2026-08-08**: the feature is cancelled, so the mode cannot be configured or misread. What replaced it as a live concern — the policy *describing* that mode — was fixed in legal version 1.3.0 (R-15) | **Closed** |
| 8 | User assumes a private/local mode exists because an older policy version said so | Medium | Low | Legal 1.3.0 states the negative explicitly ("cannot be pointed at your own API key or a model on your machine") in Terms §9, the Privacy short version, and the in-app `DataFlowNotice`; `NOTICE_VERSION` re-consent puts the corrected text in front of every existing user | Low |
| 7 | Model provider used for training | Low | High | Paid API tier terms exclude it; re-test on any provider change | Low |

**Risks 3 and 4 are open** (risk 6 closed 2026-08-08, replaced by risk 8 at a
lower residual). Each maps to a named remediation action; none is being accepted
silently, which is the distinction between a residual risk and an undocumented
one. The seven-row table is now eight rows with one struck — rows are retired in
place rather than deleted, so a reader can tell "assessed and closed" from "never
considered".

---

## 7. Data-principal impact

- **Access (§11):** `/api/account/export` returns the subject's own record plus
  the processing summary and recipient list. Prompt text is not in it because it
  is not retained — which the export says explicitly rather than leaving as an
  apparent omission.
- **Erasure (§12(3)):** cached entries expire within 24 hours; `erase_user()`
  purges Class A immediately. Prompts already sent to a provider cannot be
  recalled, and the notice says so.
- **Withdrawal (§6(4)):** withdrawing `ai_processing` is withdrawing from the
  managed relay, which is a required purpose — so the honest route is account
  deletion, and `/account/privacy` says that rather than offering a toggle that
  would silently break the product. *(It formerly said "deletion or BYOK";
  with BYOK cancelled, deletion is the only route, which is a narrower answer
  than this section could previously give.)*

---

## 8. Conclusion and sign-off

The flow is **necessary, proportionate, minimised and lawful under §16**, with
three open items (§6 risks 3, 4, 6) that are tracked rather than accepted.

The strongest fact in this assessment is not a control we built: it is that a
user who wants InsertGo out of the path entirely has a supported way to do it,
and it is one setting.

| | Name | Date | Signature |
|---|---|---|---|
| Prepared by | *(engineering lead)* | 2026-08-08 | |
| Approved by | *(R-16 privacy owner)* | | |

**Unsigned until R-16 names the owner.** Acceptance for R-22 is "signed, dated,
with a review trigger tied to any new model provider" — the trigger is in the
header; the signature is blocked on R-16.
