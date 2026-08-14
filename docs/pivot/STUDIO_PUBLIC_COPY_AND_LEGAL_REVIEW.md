# Studio public copy and legal review

Chunk 8 ships marketing copy (homepage, support, pricing waitlist, register)
without waiting on this file. **Do not invent legal answers.** Reply in-line
under each question (or copy this file) so a later change can update Privacy
and Terms.

**Contact path in product:** `support@gridmenu.ai` (privacy and legal mailboxes are not in use).

---

## 1. Ownership of Studio images

Privacy currently says: customers retain ownership of original content; GridMenu
retains aggregated, anonymised, or derivative data.

That does not distinguish:

- uploaded source dish photos
- AI-generated Studio variants
- analytics / aggregated data

**Question:** Who owns generated Studio outputs? User, GridMenu, or user-owned
with a licence for GridMenu to operate the service?

Your answer: User.  I suppose its possible that GridMenu may write to a user to ask to use their outputs in a feature or publication.  Note that the company is actually "Gorrrf Private Limited", GridMenu is just the public-facing brand.

---

## 2. Naming AI processors

Privacy lists hosting, authentication, and analytics providers. It does not name
image-generation processing (Google Gemini / Nano Banana).

**Question:** May Privacy name Google (Gemini) as a processor/subprocessor? Any
required wording or vendor list to use?

Your answer: Yes I suppose that would be more transparent.  Eventually I may use other providers too, I'm not sure if wording can accommodate that right now but perhaps allude to it.  No other specific wording required.

---

## 3. Studio private-beta Terms

Terms today describe Grid+ / Grid+Premium subscriptions, Creator Packs (one
active menu, 24 months), refunds tied to PDF exports / 50 image regenerations,
and fair use for “unlimited” menu regenerations. There is no Photo Studio
section.

**Question:** Should we add a short Studio private-beta Terms section covering:

- invite-only access (not a paid Studio plan)
- admin-granted Studio credits
- no generation SLA
- Gemini watermarks on outputs (tracker Q5: no customer-facing disclaimer; still
  a factual watermark)

Your answer (yes/no + any required clauses): We should definitely remove the package descriptions, they are now irrelevant.  I will create new packages - initially credits packs but I will review subscription models later.

---

## 4. Parked menu commercial terms

Creator Pack / Grid+ language remains in the codebase and on `/terms` while
those products are parked from the public site.

**Question:** Leave those clauses as-is with a one-line “applies to the legacy
menu builder, which is not currently offered”? Remove them from the public
Terms until menus return? Something else?

Your answer:  As alluded to in my above answer, I will move to credits packs now.  They will be similar to Creator packs in that they will be valid for a set time, but let's switch to 12 months (rather than 24), given the potential volatility of the AI market.  I haven't yet settled on a more market-friendly name than credits packs right now but I expect that will change.

---

## 5. Retention

Operational fact today: Studio images have **no plan-based TTL**; users can
archive or delete; sources with active children cannot be hard-deleted until
children are cleared.

**Question:** Any retention promise we must publish (or must not publish)
beyond that?

Your answer: No.  We do warn users when they delete dishes, if they're still insistent on deleting despite the warning, that's on them.

---

## 6. Privacy “How We Use”

Chunk 7 asked to state that we process dish photos to extract structured data
and generate variants. The Studio storage section exists; the generic “How We
Use” list is still light.

**Question:** Approve this engineer draft, or supply wording:

> If you use Photo Studio, we use your source photos and selected controls to
> extract dish information and generate image variants, and to operate, secure,
> and improve that service.

Your answer: I prefer "Uploaded photos are passed to our subprocessor(s) in order to extract dish information and facilitate image variant controls".
