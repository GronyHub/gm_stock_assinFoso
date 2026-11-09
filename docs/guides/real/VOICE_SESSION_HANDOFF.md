# Hand-off for the "Voice session continuation" session: re-record the Items / Live Sale video

Goal: ONE video for the Items / Live Sale tile in Company Laws, in the natural British voice (Piper en_GB-alba-medium),
that says out loud every law, its penalty points and why it exists, plus how to do things and the flags. Its narration is the
tile's written transcript, with times.

## What changed in the repo (already on `main`)
- `docs/guides/real/scenarios/sale.js` has the full script: 9 how-to steps, then the laws read aloud (WIC, MI, receipts,
  past sale, flags, flag checks, item groups, prices, app words), the sanctions and the Laws button. Each law step has a
  `lawRe` pattern: the transcript uses it to put that law's card under that moment of the video.
- Live Sale now has ONE `🚩 Flags (N)` dropdown (every flag on the page). Picking a flag shows a strip: what it means, why it
  matters, steps to clear it. The script's flag steps point at it. `sample.js` needs a few fake flags so the dropdown shows
  counts (for example items with no selling price / no group / duplicates): add them to the mocked `/api/flags` data and the
  item list, then check the frames with `SHOT=` / `STEP_SHOTS=1`.
- `record.js` now also writes `<out>.chapters.json` (time, title, narration text, lawRe for each step).

## Steps
1. Build and start the app (see README.md in this folder), then:
   `SESSION_TOKEN_FILE=token.txt VOICE=en_GB-alba-medium.onnx node docs/guides/real/record.js sale public/guides/sale.mp4`
2. Dry-run the new steps first (they were written without a recorder run): the Flags select locator
   (`select` containing "Flags"), the `📜 Laws` link at the end, and the law steps that just wait. Where a step has nothing
   to show, make it show something real (open the Flags dropdown, pick a flag so the strip is visible, open the Sales Log, etc.).
3. Copy `public/guides/sale.chapters.json` to `lib/videoChapters/items.json` (same shape). Commit both with the video.
4. Keep the video under about 4 minutes. If it is longer, shorten the narration of the how-to steps, not the laws.

## Rules for the narration
- Say every law in full, then its penalty points, then one sentence on why it exists / what not doing it costs.
- Say letters as letters where needed ("W I C", "M I", "S O H"), as in the existing steps.
- Law codes (LS-1 ...) are assigned by the app the first time Company Laws loads. Do not speak codes in the narration: the
  tile shows the code next to the law and links it to the moment through `lawRe`.

## After this one is approved
The same pattern is used for every other tile: script (laws read aloud + how-to) -> record -> chapters JSON.
