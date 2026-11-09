// What a tile's single video covers, second by second: the chapters (the narration, as a transcript) and which laws
// the video speaks to. Staff can tap any line to jump to that moment. Times are read from the finished video.
export type Chapter = { t: number; title: string; text: string }
export type AreaVideo = { chapters: Chapter[]; lawTimes: { re: string; t: number }[] }

export const AREA_VIDEO: Record<string, AreaVideo> = {
  items: {
    chapters: [
      { t: 4, title: 'Live Sale: record every sale as it happens', text: 'This is Live Sale. Every sale in the shop is recorded here, the moment it happens. Each item has its own card.' },
      { t: 15, title: 'Find the item', text: 'First, find the item. Type its name in Search, and the cards narrow down. You can also use All and Groups.' },
      { t: 26, title: 'Check the quantity and the price', text: 'Check the quantity and the price on the card. Change them if the customer bought more than one, or agreed a different price.' },
      { t: 36, title: 'Who is it for?', text: "Next, say who the sale is for. Type the customer's GM number, phone number or name. If you don't know them, type a short label, such as man in blue shirt." },
      { t: 48, title: 'Tap the red tick to record the sale', text: 'Then tap the red tick to record the sale. It goes straight into the Sales Log.' },
      { t: 56, title: 'New phone number: the customer form opens', text: 'If you type a phone number we do not know, the customer form opens, so you can register them as you sell.' },
      { t: 64, title: 'Several items, one customer: MI', text: 'When one customer buys several items, tap MI. Add each item to the basket, pick the customer, and issue one receipt for everything.' },
      { t: 76, title: 'WIC is a sale, GMC is shop use', text: 'Keep the switch on WIC for a sale to a customer. GMC is only for things the shop uses itself, and it is not a sale.' },
      { t: 86, title: 'Wrong sale? Undo it in the Sales Log', text: 'If you record a sale by mistake, undo it in the Sales Log. Never tap again to correct it, because that records a second sale.' },
    ],
    // First matching pattern wins; a law with no match is listed under "not in the video yet".
    lawTimes: [
      { re: 'several items|one basket|MI:|through MI', t: 64 },
      { re: 'walk-in sale|WIC', t: 76 },
      { re: 'receipts? (are|is)|never typed|Sales Log', t: 86 },
      { re: 'App words|SOH', t: 76 },
    ],
  },
}

export const fmtTime = (t: number) => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`
export const lawTime = (v: AreaVideo, text: string): number | null => {
  for (const m of v.lawTimes) if (new RegExp(m.re, 'i').test(text)) return m.t
  return null
}
