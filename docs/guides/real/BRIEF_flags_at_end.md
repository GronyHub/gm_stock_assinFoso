# Brief: re-record the Items / Live Sale video with the flags at the end

Read CLAUDE.md, AGENTS.md and VOICE_SESSION_HANDOFF.md (this folder) first. Record in the Piper en_GB-alba-medium voice (run it from the
`gm-stock-voice` environment: huggingface.co is allowed there). Push to main when done.

## What changed in the app (already on main)
- The help strip under the Live Sale toolbar is REMOVED. The only flag UI on Live Sale is the `🚩 Flags` dropdown (every flag with its count).
- ONE flag law now: "Fix flags" (recurring daily, 2 penalty points; text starts "Fix flags: every flag on Live Sale is fixed as soon as it appears ...").
- On the Items tile in Company Laws: one "Contents" list (video chapters, each with the laws read in that chapter); the flags section is at the
  BOTTOM (`lib/flagGuide.ts`: what it means / why / steps). Per-flag time chips jump to the chapter whose TITLE is `Flag: <label>` (label from
  `lib/flagGuide.ts`), falling back to the chapter whose text contains "Now, flags".

## NEW REQUIREMENTS (override anything below that conflicts)
A. THE VIDEO MUST OPEN WITH A PROPER INTRODUCTION to the Live Sale page in general, before any specific feature: what it is for, why it
   exists, and what it is used for. Make these the FIRST three chapters (show the plain Live Sale grid while speaking; no tapping yet), then
   continue with the existing "Search the item ..." chapter (remove the sentence "This is Live Sale." from that chapter so it is not repeated):
   1. title "What Live Sale is for": "Welcome to Live Sale. This is the main page of the shop. It is where every sale is recorded, one item at a
      time, at the moment it happens."
   2. title "Why it is here": "It is here because the shop's stock, cash and profit all come from what is recorded here. If a sale is not
      recorded, the stock figure is wrong, the cash does not add up, and nobody can tell what the shop really earned. Live Sale replaces writing
      sales down on paper at the end of the day."
   3. title "What you use it for": "You use it to sell items, to see what is in stock and at what price, to sell several items to one customer
      with M I, to register a customer while you sell, and to find and fix problems with the items, which the app marks as flags. Now let us
      see how, step by step."
B. EVERY flag with a real fix gets its own ~15-second chapter (see 2 below). The "Fix flags" law is read aloud as the FIRST chapter of the
   flags block at the END of the video (not earlier), followed by "Now, flags" (where they are) and then the per-flag chapters. The law card in
   the tile now contains the list of every flag with its fix steps and a time chip per flag.

## Changes to the video (`scenarios/sale.js`, `public/guides/sale.mp4`)
1. Remove the chapters "Pick a flag: what it means, why, and the steps" and "Follow the steps: tap the item, Edit, price, Save" (the strip is gone).
   Replace "The Daily Checklist asks about flags 3 times a day" with the single law "Fix flags" read aloud in full, with 2 penalty points and one
   sentence on why (`lawRe: 'Fix flags|Every flag on Live Sale'`); say the Daily Checklist is where it is enforced and the owner sets how often.
2. ALL FLAG CONTENT AT THE END, after "Everything for this page: Laws" and "Sign each law": first one chapter that shows WHERE the flags are (open the
   `🚩 Flags` dropdown; its text must contain "Now, flags"), then ONE short chapter per flag showing on screen how that flag is really fixed, in the
   order of `LIVE_SALE_FLAGS`. Chapter title exactly `Flag: <label>`. About 10-15 s each: the `means` sentence, then the steps in one or two sentences.
3. VERIFY each flag's real fix flow in the app code first (`app/(protected)/item/page.tsx` and components, `app/api/flags/route.ts`). The wording in
   `lib/flagGuide.ts` was written from memory and may be wrong or obsolete. If a flag has no working fix flow anymore, or is old pre-Zoho import
   cleanup, do not record it: list it in the final report. If its steps are wrong, correct `lib/flagGuide.ts` (the tile shows it) and use the
   corrected steps. The owner decides afterwards which flags staff may fix, so show every flag that has a real fix.
4. Add fake flags to `sample.js` so each recorded flag has something to fix on screen.
5. Keep the rest of the video as is (same wording). Run `record.js`, copy `<out>.chapters.json` to `lib/videoChapters/items.json`, and check that every
   law's `lawRe` still matches its law text (`lib/pageLaws.ts`, `lib/lawDraftsMore.ts`); first matching chapter wins (`lib/lawVideo.ts`).
6. Dry-run with `STEP_SHOTS=1` and look at the frames before the full recording. Then `npx tsc --noEmit -p .`, `npx next build`, commit
   `sale.mp4`, `items.json`, `sample.js`, `sale.js` (and `flagGuide.ts` if corrected), push.
7. Final message: video length, chapter list with times, which flags got a segment, which were skipped and why, anything unverified.
